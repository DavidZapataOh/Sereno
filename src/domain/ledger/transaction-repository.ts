import type { AccountId, OwnerId, TransactionId } from './ids';
import type { Transaction } from './transaction';

export interface TransactionFilter {
  /** ISO 8601, inclusive. */
  desde?: string;
  /** ISO 8601, inclusive. */
  hasta?: string;
  accountId?: AccountId;
  fuente?: string;
}

export interface Page<T> {
  items: T[];
  /** Cursor de la siguiente página, o `null` si no hay más. */
  nextCursor: string | null;
}

export interface ListOptions {
  limit?: number;
  cursor?: string;
}

export interface TransactionRepository {
  /** Guarda la transacción y sus apuntes de forma atómica. */
  save: (transaction: Transaction) => Promise<void>;
  findById: (id: TransactionId) => Promise<Transaction | null>;
  /**
   * Lista por fecha descendente, paginando por cursor.
   *
   * No se usa desplazamiento: `OFFSET` obliga a la base a recorrer y descartar
   * las filas anteriores, así que la página mil tarda mil veces más que la
   * primera. Con cursor, todas cuestan lo mismo.
   */
  list: (
    owner: OwnerId,
    filter?: TransactionFilter,
    options?: ListOptions,
  ) => Promise<Page<Transaction>>;
  /** Si ya existe una transacción con esa referencia. Base de la deduplicación. */
  existsByOrigin: (owner: OwnerId, fuente: string, referencia: string) => Promise<boolean>;
  delete: (id: TransactionId) => Promise<void>;
}
