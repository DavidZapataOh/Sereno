import type { OwnerId, TransactionId } from '@/domain/ledger/ids';

import type { TransferRecord, TransferState } from './transfer-record';

export interface TransferRepository {
  save: (record: TransferRecord) => Promise<void>;
  findById: (id: string) => Promise<TransferRecord | null>;
  findByTransaction: (transactionId: TransactionId) => Promise<TransferRecord | null>;
  listByOwner: (owner: OwnerId, estado?: TransferState) => Promise<TransferRecord[]>;
  /** Claves `salida|entrada` de los pares que el usuario deshizo. El detector las evita. */
  undoneKeys: (owner: OwnerId) => Promise<Set<string>>;
}
