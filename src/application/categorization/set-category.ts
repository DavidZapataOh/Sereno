import { toCategory } from '@/domain/categorization/category';
import {
  createClassification,
  type ClassificationSource,
} from '@/domain/categorization/classification';
import { withCategory, withoutCategory } from '@/domain/categorization/recategorize';
import { isCategoryAccount } from '@/domain/categorization/taxonomy';
import type { Account } from '@/domain/ledger/account';
import type { AccountId, OwnerId, TransactionId } from '@/domain/ledger/ids';
import type { Transaction } from '@/domain/ledger/transaction';

import type { CategorizationDeps } from './types';

async function cuentasDe(
  deps: Pick<CategorizationDeps, 'accounts'>,
  tx: Transaction,
): Promise<Map<AccountId, Account>> {
  const mapa = new Map<AccountId, Account>();
  for (const p of tx.postings) {
    const cuenta = await deps.accounts.findById(p.accountId);
    if (cuenta !== null) mapa.set(p.accountId, cuenta);
  }
  return mapa;
}

async function transaccionDe(
  deps: Pick<CategorizationDeps, 'transactions'>,
  owner: OwnerId,
  id: TransactionId,
): Promise<Transaction> {
  const tx = await deps.transactions.findById(id);
  if (tx === null || tx.owner !== owner) throw new Error(`No existe la transacción "${id}"`);
  return tx;
}

/** La categoría vigente de una transacción: la cuenta de su contrapartida si es de categoría. */
export function currentCategoryOf(tx: Transaction): AccountId | null {
  return tx.postings.find((p) => isCategoryAccount(p.accountId))?.accountId ?? null;
}

/**
 * Clasifica: reasienta la contrapartida contra la categoría y deja
 * constancia de quién lo decidió. Devuelve la categoría anterior para que
 * un lote pueda deshacerlo.
 */
export async function setCategory(
  deps: CategorizationDeps,
  input: {
    owner: OwnerId;
    transactionId: TransactionId;
    categoria: AccountId;
    origen: ClassificationSource;
    reglaId?: string;
    confianza?: number;
  },
): Promise<{ antes: AccountId | null }> {
  if (!isCategoryAccount(input.categoria)) {
    throw new Error(`"${input.categoria}" no es una categoría`);
  }
  const [cuenta, detalle] = await Promise.all([
    deps.accounts.findById(input.categoria),
    deps.categories.findDetails(input.categoria),
  ]);
  if (cuenta === null || detalle === null || cuenta.owner !== input.owner) {
    throw new Error(`No existe la categoría "${input.categoria}"`);
  }
  const categoria = toCategory(cuenta, detalle);

  const tx = await transaccionDe(deps, input.owner, input.transactionId);
  const antes = currentCategoryOf(tx);
  const cuentas = await cuentasDe(deps, tx);
  await deps.transactions.save(withCategory(tx, cuentas, categoria));
  await deps.classifications.save(
    createClassification({
      transactionId: tx.id,
      owner: input.owner,
      categoria: categoria.id,
      origen: input.origen,
      reglaId: input.reglaId ?? null,
      confianza:
        input.origen === 'manual' || input.origen === 'regla' ? 100 : (input.confianza ?? 0),
      clasificadoEn: deps.clock(),
    }),
  );
  return { antes };
}

/** De vuelta a «sin clasificar», borrando la constancia. */
export async function unsetCategory(
  deps: CategorizationDeps,
  input: { owner: OwnerId; transactionId: TransactionId },
): Promise<{ antes: AccountId | null }> {
  const tx = await transaccionDe(deps, input.owner, input.transactionId);
  const antes = currentCategoryOf(tx);
  const cuentas = await cuentasDe(deps, tx);
  await deps.transactions.save(withoutCategory(tx, cuentas));
  await deps.classifications.delete(tx.id);
  return { antes };
}
