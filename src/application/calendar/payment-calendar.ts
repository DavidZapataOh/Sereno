import { ciclosEntre, esPagoDelCiclo } from '@/domain/cards/billing-cycle';
import type { CardRepository } from '@/domain/cards/card-repository';
import { estadoDe, type Obligation } from '@/domain/calendar/obligation';
import type { DebtRepository } from '@/domain/debt/debt-repository';
import type { OwnerId } from '@/domain/ledger/ids';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';
import { calendarDay } from '@/domain/time/colombia';
import { mesesAntes } from '@/domain/time/month';

import { listSubscriptions, type SubscriptionsDeps } from '../subscriptions/list-subscriptions';
import type { ListDebtsDeps } from '../debt/list-debts';
import { listDebts } from '../debt/list-debts';

export interface CalendarDeps extends SubscriptionsDeps, ListDebtsDeps {
  cards: CardRepository;
  debts: DebtRepository;
  transactions: TransactionRepository;
}

/** Cuántos movimientos de la tarjeta se miran. Un par de ciclos no tienen mil. */
const VENTANA = 500;

/**
 * Qué hay que pagar entre dos días, de las tres fuentes que ya existen.
 *
 * **No calcula fechas de tarjeta:** se las pide a `billing-cycle.ts`, que las
 * tiene probadas con propiedades desde el sprint 07. Este caso de uso junta,
 * ordena y marca lo pagado.
 *
 * **Nada que el ledger no respalde.** Una tarjeta sin ciclo configurado no
 * genera obligación: no se sabe cuándo vence, y una fecha inventada es una
 * alarma falsa. La primera alarma falsa hace que se ignoren todas las demás.
 */
export async function paymentCalendar(
  deps: CalendarDeps,
  input: { owner: OwnerId; desde: string; hasta: string },
): Promise<Obligation[]> {
  const ahora = deps.clock();
  const obligaciones: Obligation[] = [];

  // --- Tarjetas: un pago por ciclo que venza en el rango.
  const tarjetas = await deps.cards.listByOwner(input.owner);
  for (const tarjeta of tarjetas) {
    const cuenta = await deps.accounts.findById(tarjeta.accountId);
    if (cuenta === null) continue;

    // Los movimientos de la tarjeta, una vez por tarjeta y no por ciclo.
    const pagina = await deps.transactions.list(
      input.owner,
      { accountId: tarjeta.accountId },
      { limit: VENTANA },
    );

    // Se empieza **dos meses antes** del rango a propósito: `ciclosEntre`
    // enumera ciclos por su corte, y el pago vence hasta un mes después de
    // cerrar. Arrancar en `desde` pierde, en silencio, el pago del ciclo que
    // abrió antes del rango —que suele ser justo el que toca pagar—.
    const ciclos = ciclosEntre(
      mesesAntes(input.desde, 2),
      input.hasta,
      tarjeta.diaDeCorte,
      tarjeta.diaDePago,
    );

    for (const ciclo of ciclos) {
      if (ciclo.pago < input.desde || ciclo.pago > input.hasta) continue;

      // Pagada si hay un apunte que **baja** la deuda dentro de la ventana de
      // pago del ciclo. Se mira el signo, no la descripción: así no depende de
      // cómo escriba cada banco. Es el mismo criterio de `cycleStatement`.
      const pago = pagina.items.find((movimiento) => {
        const apunte = movimiento.postings.find((x) => x.accountId === tarjeta.accountId);
        return (
          apunte !== undefined &&
          apunte.amount.amount > 0n &&
          esPagoDelCiclo(ciclo, movimiento.fecha)
        );
      });

      obligaciones.push({
        id: `tarjeta:${tarjeta.accountId}:${ciclo.pago}`,
        origen: 'tarjeta',
        nombre: cuenta.nombre,
        // El monto de una tarjeta no se sabe hasta que cierra el ciclo.
        monto: null,
        vence: ciclo.pago,
        estado: estadoDe(ciclo.pago, pago?.fecha ?? null, ahora),
        accountId: tarjeta.accountId,
      });
    }
  }

  // --- Suscripciones: su próximo cobro, si cae en el rango.
  const { suscripciones } = await listSubscriptions(deps, { owner: input.owner });
  for (const s of suscripciones) {
    if (s.proximoCobro === null) continue;
    const vence = calendarDay(s.proximoCobro);
    if (vence < input.desde || vence > input.hasta) continue;

    obligaciones.push({
      id: `suscripcion:${s.clave}:${vence}`,
      origen: 'suscripcion',
      nombre: s.comercio,
      monto: s.monto,
      vence,
      estado: estadoDe(vence, null, ahora),
      accountId: null,
    });
  }

  // --- Cuotas de préstamo: una al mes mientras quede saldo.
  for (const deuda of await listDebts(deps, input.owner)) {
    const dia = deuda.terminos?.diaDePago;
    if (deuda.terminos === null || dia === undefined || dia === null) continue;
    if (deuda.saldo.amount >= 0n) continue; // saldada: nada que pagar

    for (const vence of vencimientosEntre(input.desde, input.hasta, dia)) {
      obligaciones.push({
        id: `cuota:${deuda.accountId}:${vence}`,
        origen: 'cuota',
        nombre: deuda.nombre,
        monto: null,
        vence,
        estado: estadoDe(vence, null, ahora),
        accountId: deuda.accountId,
      });
    }
  }

  // Desempata por id para que dos corridas den el mismo orden: sin eso, dos
  // obligaciones del mismo día podrían salir en orden distinto cada vez.
  return obligaciones.sort((a, b) => {
    const porFecha = a.vence.localeCompare(b.vence);
    return porFecha === 0 ? a.id.localeCompare(b.id) : porFecha;
  });
}

/** Los días `dia` de cada mes entre dos fechas, ambas incluidas. */
function vencimientosEntre(desde: string, hasta: string, dia: number): string[] {
  const dias: string[] = [];
  const [anio = 1970, mes = 1] = desde.split('-').map(Number);
  for (let i = 0; i < 24; i += 1) {
    const total = (anio - 1) * 12 + (mes - 1) + i;
    const fecha = `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (fecha > hasta) break;
    if (fecha >= desde) dias.push(fecha);
  }
  return dias;
}
