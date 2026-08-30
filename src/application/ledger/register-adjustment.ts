import type { AccountRepository } from '@/domain/ledger/account-repository';
import {
  transactionId,
  type AccountId,
  type IdGenerator,
  type OwnerId,
  type TransactionId,
} from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';
import { isZero, negate, type Money } from '@/domain/money/money';

export interface LedgerDeps {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  ids: IdGenerator;
  clock: () => string;
}

/** Las transacciones manuales no tienen referencia externa: llevan UUID. */
export function manualTransactionId(ids: IdGenerator): TransactionId {
  return transactionId(`manual:${ids.next()}`);
}

/**
 * Ajuste manual: cambia el saldo de una cuenta cuadrando contra «Ajustes».
 *
 * El motivo es obligatorio y se guarda como descripción: dentro de seis meses,
 * «ajuste de 45.000» no dice nada; «comisión que el banco no listó» sí.
 * Cuadra por construcción: `createTransaction` no deja pasar otra cosa.
 */
export async function registerAdjustment(
  deps: LedgerDeps,
  input: { owner: OwnerId; accountId: AccountId; amount: Money; motivo: string; fecha?: string },
): Promise<Transaction> {
  const motivo = input.motivo.trim();
  if (motivo.length === 0) throw new Error('Un ajuste necesita motivo');
  if (isZero(input.amount)) throw new Error('Un ajuste de cero no cambia nada');

  const cuenta = await deps.accounts.findById(input.accountId);
  if (cuenta === null || cuenta.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.accountId}"`);
  }
  if (cuenta.currency !== input.amount.currency) {
    throw new Error(
      `La cuenta es en ${cuenta.currency} y el ajuste en ${input.amount.currency}: moneda distinta`,
    );
  }

  const tx = createTransaction({
    id: manualTransactionId(deps.ids),
    owner: input.owner,
    fecha: input.fecha ?? deps.clock(),
    descripcion: motivo,
    origen: { fuente: 'manual', referencia: null },
    postings: [
      { accountId: input.accountId, amount: input.amount },
      { accountId: systemAccountId('ajustes'), amount: negate(input.amount) },
    ],
  });
  await deps.transactions.save(tx);
  return tx;
}
