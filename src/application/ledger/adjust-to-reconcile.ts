import type { OwnerId } from '@/domain/ledger/ids';
import type { Transaction } from '@/domain/ledger/transaction';

import { reconcileAccount, type ReconciliationDeps } from '../reconciliation/reconcile-account';
import { calendarDay } from '@/domain/time/colombia';

import { registerAdjustment, type LedgerDeps } from './register-adjustment';

/**
 * Cierra una conciliación con un ajuste por su diferencia.
 *
 * Es una decisión del usuario, nunca automática: la conciliación mostró
 * cuánto se escapó; esto lo asume como pérdida (o ganancia) no explicada y
 * deja el motivo en el historial.
 *
 * Tras el ajuste vuelve a conciliar con el mismo saldo real: la última
 * conciliación de la cuenta pasa a cuadrar. Sin eso, «Hoy» seguiría mostrando
 * la tarjeta y un segundo toque ajustaría dos veces.
 */
export async function adjustToReconcile(
  deps: LedgerDeps & ReconciliationDeps,
  input: { owner: OwnerId; reconciliationId: string },
): Promise<Transaction> {
  const r = await deps.reconciliations.findById(input.reconciliationId);
  if (r === null || r.owner !== input.owner) {
    throw new Error(`No existe la conciliación "${input.reconciliationId}"`);
  }
  if (r.veredicto === 'cuadra') throw new Error('La conciliación cuadra: no hay nada que ajustar');

  const ajuste = await registerAdjustment(deps, {
    owner: input.owner,
    accountId: r.accountId,
    amount: r.diferencia,
    motivo: `Ajuste de conciliación al ${calendarDay(r.fecha)} (${r.detalle})`,
    fecha: r.fecha,
  });
  await reconcileAccount(deps, {
    owner: input.owner,
    accountId: r.accountId,
    saldoReal: r.saldoReal,
    fecha: r.fecha,
    fuente: 'ajuste',
    detalle: r.detalle,
  });
  return ajuste;
}
