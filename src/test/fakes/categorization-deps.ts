import type { CategorizationDeps } from '@/application/categorization/types';

import { createInMemoryAccountRepository } from './in-memory-account-repository';
import { createInMemoryBatchRepository } from './in-memory-batch-repository';
import { createInMemoryCategoryRepository } from './in-memory-category-repository';
import { createInMemoryClassificationRepository } from './in-memory-classification-repository';
import { createInMemoryEvidenceRepository } from './in-memory-evidence-repository';
import { createInMemoryRuleRepository } from './in-memory-rule-repository';
import { createInMemoryTransactionRepository } from './in-memory-transaction-repository';
import { createSequentialIds } from './sequential-ids';

/** Todos los puertos de categorización, en memoria, con reloj fijo. */
export function categorizationDeps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const categories = createInMemoryCategoryRepository();
  const classifications = createInMemoryClassificationRepository();
  const rules = createInMemoryRuleRepository();
  const evidence = createInMemoryEvidenceRepository();
  const batches = createInMemoryBatchRepository();
  const d: CategorizationDeps = {
    accounts,
    transactions,
    categories,
    classifications,
    rules,
    evidence,
    batches,
    ids: createSequentialIds('id'),
    clock: () => '2026-08-30T10:00:00.000-05:00',
  };
  return { ...d, accounts, transactions, categories, classifications, rules, evidence, batches };
}
