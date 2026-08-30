import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import type { OwnerId, TransactionId } from '@/domain/ledger/ids';

/**
 * Quién vio una transacción, cuándo y con qué dato crudo.
 *
 * Una transacción puede tener varias observaciones —la web la vio el lunes,
 * el correo el martes— y sigue siendo una. Guardar el crudo es lo que permite
 * deshacer una fusión (plan 02): la observación tiene todo lo necesario para
 * volver a ser una transacción propia.
 */
export interface Observation {
  id: string;
  transactionId: TransactionId;
  owner: OwnerId;
  fuente: string;
  referencia: string | null;
  huella: string;
  capturadoEn: string;
  runId: string | null;
  crudo: NormalizedTransaction;
}

/** Una observación por transacción y fuente: el id lo garantiza. */
export function observationId(transactionId: TransactionId, fuente: string): string {
  return `${transactionId}@${fuente}`;
}
