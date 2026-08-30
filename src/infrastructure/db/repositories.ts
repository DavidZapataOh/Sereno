import type { CategoryRepository } from '@/domain/categorization/category';
import type { ClassificationRepository } from '@/domain/categorization/classification';
import type { IngestRepository } from '@/domain/ingest/ingest-repository';
import type { TransferRepository } from '@/domain/ingest/transfer-repository';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';
import type { ReconciliationRepository } from '@/domain/reconciliation/reconciliation-repository';

import type { Database } from './database';
import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleCategoryRepository } from './drizzle-category-repository';
import { createDrizzleClassificationRepository } from './drizzle-classification-repository';
import { createDrizzleIngestRepository } from './drizzle-ingest-repository';
import { createDrizzleReconciliationRepository } from './drizzle-reconciliation-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { createDrizzleTransferRepository } from './drizzle-transfer-repository';

export interface Repositories {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  ingest: IngestRepository;
  transfers: TransferRepository;
  reconciliations: ReconciliationRepository;
  categories: CategoryRepository;
  classifications: ClassificationRepository;
}

/** Todos los repositorios sobre una misma base. Las rutas lo llaman una vez. */
export function createRepositories(db: Database): Repositories {
  return {
    accounts: createDrizzleAccountRepository(db),
    transactions: createDrizzleTransactionRepository(db),
    ingest: createDrizzleIngestRepository(db),
    transfers: createDrizzleTransferRepository(db),
    reconciliations: createDrizzleReconciliationRepository(db),
    categories: createDrizzleCategoryRepository(db),
    classifications: createDrizzleClassificationRepository(db),
  };
}
