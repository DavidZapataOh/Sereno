import type { AccountId } from '@/domain/ledger/ids';

import type { Reconciliation } from './reconciliation';

export interface ReconciliationRepository {
  save: (reconciliation: Reconciliation) => Promise<void>;
  findById: (id: string) => Promise<Reconciliation | null>;
  findLatest: (accountId: AccountId) => Promise<Reconciliation | null>;
  listByAccount: (accountId: AccountId) => Promise<Reconciliation[]>;
}
