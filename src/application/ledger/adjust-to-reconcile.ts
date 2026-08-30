import type { OwnerId } from '@/domain/ledger/ids';
import type { Transaction } from '@/domain/ledger/transaction';
import type { ReconciliationRepository } from '@/domain/reconciliation/reconciliation-repository';
import { calendarDay } from '@/domain/time/colombia';

import { registerAdjustment, type LedgerDeps } from './register-adjustment';

/**
 * Cierra una conciliación con un ajuste por su diferencia.
 *
 * Es una decisión del usuario, nunca automática: la conciliación mostró
 * cuánto se escapó; esto lo asume como pérdida (o ganancia) no explicada y
 * deja el motivo en el historial.
 */
export async function adjustToReconcile(
  deps: LedgerDeps & { reconciliations: ReconciliationRepository },
  input: { owner: OwnerId; reconciliationId: string },
): Promise<Transaction> {
  const r = await deps.reconciliations.findById(input.reconciliationId);
  if (r === null || r.owner !== input.owner) {
    throw new Error(`No existe la conciliación "${input.reconciliationId}"`);
  }
  if (r.veredicto === 'cuadra') throw new Error('La conciliación cuadra: no hay nada que ajustar');

  return registerAdjustment(deps, {
    owner: input.owner,
    accountId: r.accountId,
    amount: r.diferencia,
    motivo: `Ajuste de conciliación al ${calendarDay(r.fecha)} (${r.detalle})`,
    fecha: r.fecha,
  });
}
