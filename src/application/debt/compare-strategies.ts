import { absolute, type Money } from '@/domain/money/money';
import type { OwnerId } from '@/domain/ledger/ids';
import { anualDe } from '@/domain/debt/rate';
import { simular, type Resultado } from '@/domain/debt/payoff';
import type { DeudaEnSimulacion } from '@/domain/debt/strategy';
import { calendarDay } from '@/domain/time/colombia';

import { listDebts, type ListDebtsDeps } from './list-debts';

export interface CompareDeps extends ListDebtsDeps {
  clock: () => string;
}

export interface Comparacion {
  avalancha: Resultado;
  bolaDeNieve: Resultado;
  /**
   * De qué supuestos sale la fecha. Sin ellos, una fecha es una promesa.
   *
   * Se enseñan junto a la cifra, no escondidos: quien lee «sales en marzo de
   * 2028» tiene derecho a saber que eso vale si no vuelve a usar la tarjeta.
   */
  supuestos: string[];
}

/** El mínimo que se supone de una deuda sin cuota declarada. */
export const MINIMO_POR_DEFECTO = 0.03;

/**
 * Las dos estrategias, con las deudas reales del ledger.
 *
 * **La app no elige.** La avalancha ahorra dinero y la bola de nieve cierra
 * deudas antes; el problema de este usuario es la constancia, y ver
 * desaparecer una deuda la sostiene mejor que ahorrarse un interés que no se
 * ve. Se enseñan las dos con sus cifras.
 */
export async function compareStrategies(
  deps: CompareDeps,
  input: { owner: OwnerId; presupuesto: Money },
): Promise<Comparacion> {
  const resumenes = await listDebts(deps, input.owner);
  const supuestos: string[] = [];

  const deudas: DeudaEnSimulacion[] = [];
  for (const r of resumenes) {
    // En el ledger un pasivo es negativo: se debe cuando el número baja de cero.
    const saldo = absolute(r.saldo);
    if (saldo.amount <= 0n) continue;

    if (r.terminos === null || r.terminos.tasa === null) {
      supuestos.push(`${r.nombre}: sin tasa declarada, se simula sin intereses`);
    }

    deudas.push({
      id: r.accountId,
      nombre: r.nombre,
      saldo,
      tasa: r.terminos?.tasa ?? null,
      // Sin cuota declarada se supone el 3 % del saldo, que es el mínimo
      // típico de una tarjeta en Colombia. Se dice, no se esconde.
      minimo: { amount: minimoDe(saldo.amount), currency: saldo.currency },
    });
  }

  supuestos.push(
    `Pagando ${formatearPresupuesto(input.presupuesto)} al mes entre todas`,
    'Suponiendo que no vuelvas a usar las tarjetas',
  );
  for (const d of deudas) {
    if (d.tasa !== null) {
      supuestos.push(`${d.nombre}: ${(anualDe(d.tasa) * 100).toFixed(1)} % efectivo anual`);
    }
  }

  const desde = calendarDay(deps.clock()).slice(0, 7);
  return {
    avalancha: simular(deudas, { estrategia: 'avalancha', presupuesto: input.presupuesto, desde }),
    bolaDeNieve: simular(deudas, {
      estrategia: 'bola-de-nieve',
      presupuesto: input.presupuesto,
      desde,
    }),
    supuestos,
  };
}

/**
 * El mínimo que se supone cuando no hay cuota declarada: el 3 % del saldo, que
 * es el típico de una tarjeta en Colombia. Nunca menos de mil pesos, para que
 * un saldo diminuto no genere una cuota de cero que no salda nunca.
 */
function minimoDe(saldo: bigint): bigint {
  const tres = (saldo * BigInt(Math.round(MINIMO_POR_DEFECTO * 100))) / 100n;
  return tres < 1_000n ? (saldo < 1_000n ? saldo : 1_000n) : tres;
}

function formatearPresupuesto(m: Money): string {
  return `$ ${m.amount.toLocaleString('es-CO')}`;
}
