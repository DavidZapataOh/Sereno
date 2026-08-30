import type { CategoryRepository } from '@/domain/categorization/category';
import type { ClassificationRepository } from '@/domain/categorization/classification';
import type { RuleRepository } from '@/domain/categorization/rule-repository';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { IdGenerator } from '@/domain/ledger/ids';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';

export interface CategorizationDeps {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  categories: CategoryRepository;
  classifications: ClassificationRepository;
  rules: RuleRepository;
  ids: IdGenerator;
  clock: () => string;
}
