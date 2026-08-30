import type { OwnerId, TransactionId } from '@/domain/ledger/ids';
import type { Transaction } from '@/domain/ledger/transaction';

import type { Observation } from './observation';

export type TransferState = 'detectada' | 'confirmada' | 'deshecha';

/**
 * Lo que hace falta para deshacer una transferencia detectada: las dos
 * transacciones originales y las observaciones que se quitaron de la entrada.
 * Las de la salida no se tocan al fundir, así que no hace falta guardarlas.
 */
export interface TransferRecord {
  id: string;
  owner: OwnerId;
  /** La transacción fundida. Coincide con `salida.id`. */
  transactionId: TransactionId;
  salida: Transaction;
  entrada: Transaction;
  observacionesEntrada: Observation[];
  estado: TransferState;
  detectadaEn: string;
  resueltaEn: string | null;
}
