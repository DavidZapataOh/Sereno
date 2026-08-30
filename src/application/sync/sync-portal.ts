import type { Capture } from '@/domain/capture/reassembler';
import type { OwnerId } from '@/domain/ledger/ids';
import { sourceAccountId } from '@/domain/ledger/system-accounts';
import type { Money } from '@/domain/money/money';
import type { PortalId } from '@/domain/portals/registry';
import type { Reconciliation } from '@/domain/reconciliation/reconciliation';
import { calendarDay } from '@/domain/time/colombia';

import { detectTransfers } from '../ingest/detect-transfers';
import { ingestCaptures } from '../ingest/ingest-captures';
import type { IngestDeps, IngestSummary } from '../ingest/types';
import { registerAdjustment } from '../ledger/register-adjustment';
import {
  reconcileFromCaptures,
  type ReconciliationDeps,
} from '../reconciliation/reconcile-from-captures';

/** Todos los puertos del sprint. Las rutas lo construyen una vez. */
export type AppDeps = IngestDeps & ReconciliationDeps;

export interface SyncSummary extends IngestSummary {
  transferencias: number;
  conciliacion: Reconciliation | null;
  /** Solo en la primera sincronización: lo que había antes de los movimientos capturados. */
  saldoInicial: Money | null;
}

/**
 * Lo que pasa al tocar «Importar»: ingerir, fijar el saldo inicial si es la
 * primera vez, conciliar, detectar transferencias.
 *
 * El saldo inicial existe porque el ledger arranca en cero y solo conoce los
 * movimientos capturados; no sabe cuánto había antes. En la primera
 * sincronización, la diferencia entre lo que el banco declara y lo que suman
 * los movimientos es, por definición, ese «antes»: se asienta como ajuste con
 * motivo, igual que el saldo de apertura de cualquier app de finanzas. A partir
 * de ahí, una diferencia es de verdad dinero que se escapó, y se muestra.
 */
export async function syncPortal(
  deps: AppDeps,
  input: { owner: OwnerId; portalId: PortalId; captures: Capture[] },
): Promise<SyncSummary> {
  const cuenta = sourceAccountId(input.portalId);
  // «Primera» = la cuenta nunca ha cuadrado con el banco. Así también la
  // reciben las instalaciones que ya conciliaron sin cuadrar antes de que
  // existiera el saldo inicial; y tras asumir una diferencia (que deja una
  // conciliación que cuadra) toda diferencia posterior es real.
  const previas = await deps.reconciliations.listByAccount(cuenta);
  const esLaPrimera = !previas.some((c) => c.veredicto === 'cuadra');

  const ingesta = await ingestCaptures(deps, input);
  let [conciliacion] = await reconcileFromCaptures(deps, input);
  let saldoInicial: Money | null = null;

  if (esLaPrimera && conciliacion !== undefined && conciliacion.veredicto !== 'cuadra') {
    saldoInicial = conciliacion.diferencia;
    await registerAdjustment(deps, {
      owner: input.owner,
      accountId: conciliacion.accountId,
      amount: saldoInicial,
      motivo: `Saldo inicial al ${calendarDay(conciliacion.fecha)}: lo anterior a la primera sincronización`,
      fecha: conciliacion.fecha,
    });
    // Con el saldo inicial asentado, la conciliación real es esta segunda.
    [conciliacion] = await reconcileFromCaptures(deps, input);
  }

  const { detectadas } = await detectTransfers(deps, { owner: input.owner });
  return {
    ...ingesta,
    transferencias: detectadas,
    conciliacion: conciliacion ?? null,
    saldoInicial,
  };
}
