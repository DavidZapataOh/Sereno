import { observationId } from '@/domain/ingest/observation';
import type { TransferRecord } from '@/domain/ingest/transfer-record';
import type { OwnerId } from '@/domain/ledger/ids';

import type { IngestDeps } from './types';

async function registro(deps: IngestDeps, owner: OwnerId, id: string): Promise<TransferRecord> {
  const r = await deps.transfers.findById(id);
  if (r === null || r.owner !== owner) throw new Error(`No existe la transferencia "${id}"`);
  return r;
}

/** El usuario dice «sí, es una transferencia». Solo cambia el estado. */
export async function confirmTransfer(
  deps: IngestDeps,
  input: { owner: OwnerId; transferId: string },
): Promise<void> {
  const r = await registro(deps, input.owner, input.transferId);
  if (r.estado === 'deshecha') throw new Error('La transferencia ya fue deshecha');
  await deps.transfers.save({ ...r, estado: 'confirmada', resueltaEn: deps.clock() });
}

/**
 * El usuario dice «no, eran dos cosas distintas». Se restauran las dos
 * transacciones y las observaciones de la entrada, y el registro queda como
 * deshecho para que el detector no vuelva a proponer el par.
 */
export async function undoTransfer(
  deps: IngestDeps,
  input: { owner: OwnerId; transferId: string },
): Promise<void> {
  const r = await registro(deps, input.owner, input.transferId);
  if (r.estado === 'deshecha') throw new Error('La transferencia ya fue deshecha');

  await deps.transactions.save(r.salida);
  await deps.transactions.save(r.entrada);
  for (const o of r.observacionesEntrada) {
    await deps.ingest.saveObservation({
      ...o,
      id: observationId(r.entrada.id, o.fuente),
      transactionId: r.entrada.id,
    });
  }
  await deps.transfers.save({ ...r, estado: 'deshecha', resueltaEn: deps.clock() });
}
