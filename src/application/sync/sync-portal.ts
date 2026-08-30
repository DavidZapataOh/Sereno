import type { Capture } from '@/domain/capture/reassembler';
import type { OwnerId } from '@/domain/ledger/ids';
import type { PortalId } from '@/domain/portals/registry';
import type { Reconciliation } from '@/domain/reconciliation/reconciliation';

import { detectTransfers } from '../ingest/detect-transfers';
import { ingestCaptures } from '../ingest/ingest-captures';
import type { IngestDeps, IngestSummary } from '../ingest/types';
import {
  reconcileFromCaptures,
  type ReconciliationDeps,
} from '../reconciliation/reconcile-from-captures';

/** Todos los puertos del sprint. Las rutas lo construyen una vez. */
export type AppDeps = IngestDeps & ReconciliationDeps;

export interface SyncSummary extends IngestSummary {
  transferencias: number;
  conciliacion: Reconciliation | null;
}

/**
 * Lo que pasa al tocar «Importar»: ingerir, conciliar, detectar transferencias.
 *
 * En ese orden. La conciliación va después de ingerir para que el saldo
 * calculado incluya lo recién entrado; las transferencias van después porque
 * fundirlas no cambia el saldo de ningún activo.
 */
export async function syncPortal(
  deps: AppDeps,
  input: { owner: OwnerId; portalId: PortalId; captures: Capture[] },
): Promise<SyncSummary> {
  const ingesta = await ingestCaptures(deps, input);
  const [conciliacion] = await reconcileFromCaptures(deps, input);
  const { detectadas } = await detectTransfers(deps, { owner: input.owner });
  return { ...ingesta, transferencias: detectadas, conciliacion: conciliacion ?? null };
}
