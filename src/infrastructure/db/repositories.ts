import type { CardRepository } from '@/domain/cards/card-repository';
import type { WalletRepository } from '@/domain/crypto/wallet-repository';
import type { DebtRepository } from '@/domain/debt/debt-repository';
import type { SnapshotRepository } from '@/domain/overview/snapshot-repository';
import type { BudgetRepository } from '@/domain/budget/budget-repository';
import type { SinkingRepository } from '@/domain/sinking/sinking-repository';
import type { BatchRepository } from '@/domain/categorization/batch';
import type { CategoryRepository } from '@/domain/categorization/category';
import type { ClassificationRepository } from '@/domain/categorization/classification';
import type { EvidenceRepository } from '@/domain/categorization/evidence-repository';
import type { RuleRepository } from '@/domain/categorization/rule-repository';
import type { IngestRepository } from '@/domain/ingest/ingest-repository';
import type { TransferRepository } from '@/domain/ingest/transfer-repository';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';
import type { ReconciliationRepository } from '@/domain/reconciliation/reconciliation-repository';
import type { RateRepository } from '@/domain/rates/rate-repository';
import type { SyncStateRepository } from '@/domain/sync/server-client';

import type { Database } from './database';
import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleBatchRepository } from './drizzle-batch-repository';
import { createDrizzleCardRepository } from './drizzle-card-repository';
import { createDrizzleCategoryRepository } from './drizzle-category-repository';
import { createDrizzleClassificationRepository } from './drizzle-classification-repository';
import { createDrizzleEvidenceRepository } from './drizzle-evidence-repository';
import { createDrizzleIngestRepository } from './drizzle-ingest-repository';
import { createDrizzleRateRepository } from './drizzle-rate-repository';
import { createDrizzleReconciliationRepository } from './drizzle-reconciliation-repository';
import { createDrizzleSyncStateRepository } from './drizzle-sync-state-repository';
import { createDrizzleRuleRepository } from './drizzle-rule-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { createDrizzleTransferRepository } from './drizzle-transfer-repository';
import { createDrizzleDebtRepository } from './drizzle-debt-repository';
import { createDrizzleBudgetRepository } from './drizzle-budget-repository';
import { createDrizzleSinkingRepository } from './drizzle-sinking-repository';
import { createDrizzleSnapshotRepository } from './drizzle-snapshot-repository';
import { createDrizzleWalletRepository } from './drizzle-wallet-repository';

export interface Repositories {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  ingest: IngestRepository;
  transfers: TransferRepository;
  reconciliations: ReconciliationRepository;
  categories: CategoryRepository;
  classifications: ClassificationRepository;
  rules: RuleRepository;
  evidence: EvidenceRepository;
  batches: BatchRepository;
  sync: SyncStateRepository;
  cards: CardRepository;
  rates: RateRepository;
  wallets: WalletRepository;
  snapshots: SnapshotRepository;
  debts: DebtRepository;
  fondos: SinkingRepository;
  presupuesto: BudgetRepository;
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
    rules: createDrizzleRuleRepository(db),
    evidence: createDrizzleEvidenceRepository(db),
    batches: createDrizzleBatchRepository(db),
    sync: createDrizzleSyncStateRepository(db),
    cards: createDrizzleCardRepository(db),
    rates: createDrizzleRateRepository(db),
    wallets: createDrizzleWalletRepository(db),
    snapshots: createDrizzleSnapshotRepository(db),
    debts: createDrizzleDebtRepository(db),
    fondos: createDrizzleSinkingRepository(db),
    presupuesto: createDrizzleBudgetRepository(db),
  };
}
