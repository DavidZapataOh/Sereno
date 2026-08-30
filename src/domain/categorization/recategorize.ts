import { isRealAccount, type Account } from '@/domain/ledger/account';
import type { AccountId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction, type Posting, type Transaction } from '@/domain/ledger/transaction';
import { isNegative } from '@/domain/money/money';

import type { Category } from './category';

export class NotCategorizableError extends Error {
  constructor(razon: string) {
    super(`No se puede clasificar: ${razon}`);
    this.name = 'NotCategorizableError';
  }
}

/**
 * El apunte de contrapartida: el que no es de una cuenta real. Existe solo
 * cuando hay exactamente dos apuntes y uno solo es real; una transferencia
 * (dos reales) no tiene, y un reparto (tres o más) se clasifica por partes,
 * fuera de este sprint.
 */
export function counterpartOf(tx: Transaction, cuentas: Map<AccountId, Account>): Posting | null {
  if (tx.postings.length !== 2) return null;
  const clasificados: { posting: Posting; real: boolean }[] = [];
  for (const p of tx.postings) {
    const cuenta = cuentas.get(p.accountId);
    if (cuenta === undefined) return null;
    clasificados.push({ posting: p, real: isRealAccount(cuenta.kind) });
  }
  const reales = clasificados.filter((c) => c.real);
  if (reales.length !== 1) return null;
  return clasificados.find((c) => !c.real)?.posting ?? null;
}

function reasentar(tx: Transaction, contrapartida: Posting, destino: AccountId): Transaction {
  return createTransaction({
    ...tx,
    postings: tx.postings.map((p) => (p === contrapartida ? { ...p, accountId: destino } : p)),
  });
}

/** La misma transacción con la contrapartida contra la categoría. */
export function withCategory(
  tx: Transaction,
  cuentas: Map<AccountId, Account>,
  categoria: Category,
): Transaction {
  if (categoria.archivedAt !== null) {
    throw new NotCategorizableError(`la categoría «${categoria.nombre}» está archivada`);
  }
  const contrapartida = counterpartOf(tx, cuentas);
  if (contrapartida === null) {
    throw new NotCategorizableError('no tiene una contrapartida única (¿transferencia o reparto?)');
  }
  return reasentar(tx, contrapartida, categoria.id);
}

/** De vuelta a «sin clasificar», según entre o salga dinero de la cuenta real. */
export function withoutCategory(tx: Transaction, cuentas: Map<AccountId, Account>): Transaction {
  const contrapartida = counterpartOf(tx, cuentas);
  if (contrapartida === null) {
    throw new NotCategorizableError('no tiene una contrapartida única');
  }
  const real = tx.postings.find((p) => p !== contrapartida);
  const sale = real !== undefined && isNegative(real.amount);
  return reasentar(
    tx,
    contrapartida,
    systemAccountId(sale ? 'gastos-sin-clasificar' : 'ingresos-sin-clasificar'),
  );
}
