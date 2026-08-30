import type { OwnerId } from '@/domain/ledger/ids';

import type { Rule } from './rule';

export interface RuleRepository {
  save: (rule: Rule) => Promise<void>;
  findById: (id: string) => Promise<Rule | null>;
  listByOwner: (owner: OwnerId) => Promise<Rule[]>;
  delete: (id: string) => Promise<void>;
}
