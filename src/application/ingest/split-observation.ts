import { observationId, type Observation } from '@/domain/ingest/observation';
import { ingestedTransactionId, toLedgerTransaction } from '@/domain/ingest/to-transaction';
import { transactionId, type OwnerId, type TransactionId } from '@/domain/ledger/ids';
import { sourceAccountId } from '@/domain/ledger/system-accounts';

import type { IngestDeps } from './types';

/**
 * Localiza una observación por su id.
 *
 * El puerto no tiene `findObservationById` a propósito: el id de una
 * observación es `<transacción>@<fuente>`, así que se resuelve con
 * `listObservations` de esa transacción.
 */
async function buscarObservacion(
  deps: IngestDeps,
  owner: OwnerId,
  id: string,
): Promise<Observation | null> {
  const arroba = id.lastIndexOf('@');
  if (arroba <= 0) return null;
  const observaciones = await deps.ingest.listObservations(transactionId(id.slice(0, arroba)));
  return observaciones.find((o) => o.id === id && o.owner === owner) ?? null;
}

/**
 * Deshace una fusión: la observación vuelve a ser una transacción propia.
 *
 * No hace falta pedirle nada al banco: la observación guardó el crudo. La
 * transacción original conserva sus otras observaciones intactas.
 */
export async function splitObservation(
  deps: IngestDeps,
  input: { owner: OwnerId; observationId: string },
): Promise<TransactionId> {
  const observacion = await buscarObservacion(deps, input.owner, input.observationId);
  if (observacion === null) throw new Error(`No existe la observación "${input.observationId}"`);

  const hermanas = await deps.ingest.listObservations(observacion.transactionId);
  if (hermanas.length < 2) {
    throw new Error('Es la única observación de su transacción: no hay nada que separar');
  }

  const referencia = observacion.referencia;
  if (referencia === null) throw new Error('La observación no tiene referencia');

  const nuevoId = ingestedTransactionId(observacion.fuente, referencia);
  await deps.transactions.save(
    toLedgerTransaction(observacion.crudo, {
      owner: input.owner,
      assetAccountId: sourceAccountId(observacion.fuente),
      id: nuevoId,
    }),
  );
  await deps.ingest.deleteObservation(observacion.id);
  await deps.ingest.saveObservation({
    ...observacion,
    id: observationId(nuevoId, observacion.fuente),
    transactionId: nuevoId,
  });

  return nuevoId;
}
