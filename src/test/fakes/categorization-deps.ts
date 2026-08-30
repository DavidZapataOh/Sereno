import type { CategorizationDeps } from '@/application/categorization/types';

import { createInMemoryAccountRepository } from './in-memory-account-repository';
import { createInMemoryCategoryRepository } from './in-memory-category-repository';
import { createInMemoryClassificationRepository } from './in-memory-classification-repository';
import { createInMemoryTransactionRepository } from './in-memory-transaction-repository';
import { createSequentialIds } from './sequential-ids';

/** Todos los puertos de categorización, en memoria, con reloj fijo. */
export function categorizationDeps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const categories = createInMemoryCategoryRepository();
  const classifications = createInMemoryClassificationRepository();
  const d: CategorizationDeps = {
    accounts,
    transactions,
    categories,
    classifications,
    ids: createSequentialIds('id'),
    clock: () => '2026-08-30T10:00:00.000-05:00',
  };
  return { ...d, accounts, transactions, categories, classifications };
}
