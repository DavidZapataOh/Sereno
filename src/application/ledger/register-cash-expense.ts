import type { OwnerId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import { isNegative, isZero, negate, type Money } from '@/domain/money/money';

import { manualTransactionId, type LedgerDeps } from './register-adjustment';

/**
 * El único dato que la app le pide al usuario: cuánto gastó del efectivo.
 *
 * Existe como corrección, no como flujo (principio 4): el efectivo entró por
 * un retiro capturado; esto solo dice adónde fue.
 */
export async function registerCashExpense(
  deps: LedgerDeps,
  input: { owner: OwnerId; amount: Money; descripcion: string; fecha?: string },
): Promise<Transaction> {
  if (isNegative(input.amount) || isZero(input.amount)) {
    throw new Error('El monto debe ser positivo');
  }
  const descripcion = input.descripcion.trim();
  if (descripcion.length === 0) throw new Error('Un gasto necesita descripción');

  const tx = createTransaction({
    id: manualTransactionId(deps.ids),
    owner: input.owner,
    fecha: input.fecha ?? deps.clock(),
    descripcion,
    origen: { fuente: 'manual', referencia: null },
    postings: [
      { accountId: systemAccountId('efectivo'), amount: negate(input.amount) },
      { accountId: systemAccountId('gastos-sin-clasificar'), amount: input.amount },
    ],
  });
  await deps.transactions.save(tx);
  return tx;
}
