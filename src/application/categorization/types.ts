import type { CategoryRepository } from '@/domain/categorization/category';
import type { ClassificationRepository } from '@/domain/categorization/classification';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { IdGenerator } from '@/domain/ledger/ids';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';

export interface CategorizationDeps {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  categories: CategoryRepository;
  classifications: ClassificationRepository;
  ids: IdGenerator;
  clock: () => string;
}
