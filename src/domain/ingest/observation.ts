import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import type { OwnerId, TransactionId } from '@/domain/ledger/ids';

import type { Channel } from './channel';

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
  /** Por dónde llegó. Dos canales de la misma fuente son dos observaciones. */
  canal: Channel;
  referencia: string | null;
  huella: string;
  capturadoEn: string;
  runId: string | null;
  crudo: NormalizedTransaction;
}

/**
 * Una observación por transacción, fuente **y canal**: el id lo garantiza.
 *
 * Sin el canal, el mismo movimiento visto por el portal y por el correo daba
 * el mismo id, y el guardado —que hace `onConflictDoUpdate`— dejaba una sola
 * fila: la segunda pisaba a la primera en silencio, y deshacer la fusión
 * reconstruía desde el crudo equivocado.
 */
export function observationId(
  transactionId: TransactionId,
  fuente: string,
  canal: Channel,
): string {
  return `${transactionId}@${fuente}:${canal}`;
}
