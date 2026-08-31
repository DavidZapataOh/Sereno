import { extractorFor } from '@/domain/capture/extractors';
import type { Capture } from '@/domain/capture/reassembler';
import { startDayOf } from '@/domain/ingest/account-start';
import type { OwnerId } from '@/domain/ledger/ids';
import { getPortal, type PortalId } from '@/domain/portals/registry';

import { ingestNormalized } from './ingest-normalized';
import type { IngestDeps, IngestSummary } from './types';

export type { IngestDeps, IngestSummary } from './types';

export interface IngestInput {
  owner: OwnerId;
  portalId: PortalId;
  captures: Capture[];
}

/**
 * La entrada por capturas de la WebView: extrae y delega en el núcleo.
 *
 * El extractor filtra por endpoint: una sesión bancaria captura decenas de
 * respuestas y solo una es la de movimientos.
 */
export async function ingestCaptures(deps: IngestDeps, input: IngestInput): Promise<IngestSummary> {
  const portal = getPortal(input.portalId);
  const extraer = extractorFor(input.portalId);
  if (portal === undefined || extraer === null) {
    throw new Error(`El portal "${input.portalId}" no expone movimientos por web`);
  }

  const lote = input.captures.flatMap(extraer);
  const capturadoEn = input.captures[0]?.capturedAt ?? deps.clock();
  // Sereno cuenta esta fuente desde el día de su primera corrida.
  const desde = startDayOf(
    await deps.ingest.findFirstRun(input.owner, input.portalId),
    deps.clock(),
  );

  return ingestNormalized(deps, {
    owner: input.owner,
    fuente: input.portalId,
    // Una captura sale de la sesión del portal, por definición.
    canal: 'web',
    nombreFuente: portal.nombre,
    lote,
    capturadoEn,
    capturas: input.captures.length,
    desde,
  });
}
