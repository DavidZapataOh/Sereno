import {
  mesVacio,
  proyectar,
  salida,
  type FlujoDelMes,
  type Proyeccion,
} from '@/domain/cashflow/projection';
import type { OwnerId } from '@/domain/ledger/ids';
import { add, zero, type Money } from '@/domain/money/money';
import { calendarDay } from '@/domain/time/colombia';

import { paymentCalendar, type CalendarDeps } from '../calendar/payment-calendar';
import { getOverview, type OverviewDeps } from '../overview/get-overview';
import { listFunds, type FundDeps } from '../sinking/manage-funds';

export interface CashFlowDeps extends CalendarDeps, OverviewDeps, FundDeps {}

export interface FlujoProyectado extends Proyeccion {
  /** De qué supuestos sale. Sin ellos, una proyección es una promesa. */
  supuestos: string[];
}

/**
 * El saldo de los próximos meses, con lo que se sabe.
 *
 * **Comprometido**: las obligaciones del calendario (cuotas, tarjetas,
 * suscripciones) y los aportes a fondos y metas. Tienen fecha y monto.
 *
 * **Estimado**: nada todavía. Se declara vacío en vez de inventarse un gasto
 * habitual que no se ha medido —una estimación mal hecha es peor que ninguna, y
 * aquí el sitio para ponerla ya está preparado y separado—.
 */
export async function cashFlow(
  deps: CashFlowDeps,
  input: { owner: OwnerId; meses: number },
): Promise<FlujoProyectado> {
  const hoy = calendarDay(deps.clock());
  const overview = await getOverview(deps, input.owner);
  const moneda = overview.patrimonio.currency;
  const supuestos: string[] = [];

  const meses = mesesDesde(hoy.slice(0, 7), input.meses);
  const flujos = new Map<string, FlujoDelMes>(meses.map((m) => [m, mesVacio(m, moneda)]));

  // --- Obligaciones con fecha: comprometido.
  const obligaciones = await paymentCalendar(deps, {
    owner: input.owner,
    desde: hoy,
    hasta: `${meses.at(-1) ?? hoy.slice(0, 7)}-28`,
  });
  let sinMonto = 0;
  for (const o of obligaciones) {
    if (o.estado === 'pagada') continue;
    const flujo = flujos.get(o.vence.slice(0, 7));
    if (flujo === undefined) continue;
    if (o.monto === null) {
      // Una tarjeta sin ciclo cerrado no tiene monto conocido. Contarla como
      // cero diría que no cuesta nada; se cuenta cuántas quedan fuera y se dice.
      sinMonto += 1;
      continue;
    }
    flujo.comprometido = add(flujo.comprometido, salida(o.monto));
  }
  if (sinMonto > 0) {
    supuestos.push(
      `${String(sinMonto)} pago(s) de tarjeta sin monto conocido todavía: no están contados`,
    );
  }

  // --- Aportes a fondos y metas: comprometido, porque son decisiones tomadas.
  const fondos = await listFunds(deps, input.owner);
  const aporteMensual = fondos.reduce<Money>((acc, f) => add(acc, f.aporteDeEsteMes), zero(moneda));
  if (aporteMensual.amount > 0n) {
    for (const mes of meses) {
      const flujo = flujos.get(mes);
      if (flujo !== undefined) flujo.comprometido = add(flujo.comprometido, salida(aporteMensual));
    }
    supuestos.push('Incluye lo que apartas cada mes para fondos y metas');
  }

  supuestos.push('Suponiendo que no aparezcan gastos nuevos');
  supuestos.push('El gasto habitual todavía no está incluido: solo lo que tiene fecha');

  const proyeccion = proyectar(
    saldoDisponible(overview.cuentas),
    meses.map((m) => flujos.get(m) ?? mesVacio(m, moneda)),
    { meses: input.meses },
  );
  return { ...proyeccion, supuestos };
}

/** Lo que hay hoy en cuentas de activo: de ahí sale lo que se va a pagar. */
function saldoDisponible(cuentas: { account: { kind: string }; enPesos: Money | null }[]): Money {
  let total = zero('COP');
  for (const c of cuentas) {
    if (c.account.kind === 'activo' && c.enPesos !== null) total = add(total, c.enPesos);
  }
  return total;
}

function mesesDesde(mes: string, cuantos: number): string[] {
  const [anio = 1970, m = 1] = mes.split('-').map(Number);
  return Array.from({ length: cuantos }, (_, i) => {
    const total = (anio - 1) * 12 + (m - 1) + i;
    return `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}
