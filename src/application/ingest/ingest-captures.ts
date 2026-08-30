import { extractorFor } from '@/domain/capture/extractors';
import type { Capture } from '@/domain/capture/reassembler';
import { fingerprintOf } from '@/domain/ingest/fingerprint';
import type { IngestRepository } from '@/domain/ingest/ingest-repository';
import type { IngestRun } from '@/domain/ingest/ingest-run';
import { observationId } from '@/domain/ingest/observation';
import { ingestedTransactionId, toLedgerTransaction } from '@/domain/ingest/to-transaction';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { IdGenerator, OwnerId } from '@/domain/ledger/ids';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';
import { getPortal, type PortalId } from '@/domain/portals/registry';

import { ensureSourceAccount, ensureSystemAccounts } from '../ledger/ensure-system-accounts';

export interface IngestDeps {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  ingest: IngestRepository;
  ids: IdGenerator;
  /** Ahora, en ISO. Inyectado para que las pruebas fijen el tiempo. */
  clock: () => string;
}

export interface IngestInput {
  owner: OwnerId;
  portalId: PortalId;
  captures: Capture[];
}

export interface IngestSummary {
  runId: string;
  capturas: number;
  extraidas: number;
  nuevas: number;
  duplicadas: number;
  /** Movimientos sin referencia: no tienen id determinista y no entran. */
  sinReferencia: number;
}

/**
 * La tubería: capturas → transacciones normalizadas → transacciones del ledger.
 *
 * Idempotente por construcción: el id de cada transacción se deriva de
 * (fuente, referencia). Si la observación ya existe, es duplicada y no se toca.
 *
 * No hay transacción de base de datos alrededor del lote entero, a propósito.
 * Un lote de trescientos movimientos que falla en el doscientos deja
 * doscientos guardados correctamente; el reintento no los repite porque son
 * idempotentes. La corrida registra hasta dónde llegó y con qué error.
 */
export async function ingestCaptures(deps: IngestDeps, input: IngestInput): Promise<IngestSummary> {
  const portal = getPortal(input.portalId);
  const extraer = extractorFor(input.portalId);
  if (portal === undefined || extraer === null) {
    throw new Error(`El portal "${input.portalId}" no expone movimientos por web`);
  }

  const run: IngestRun = {
    id: deps.ids.next(),
    owner: input.owner,
    fuente: input.portalId,
    iniciadoEn: deps.clock(),
    terminadoEn: null,
    capturas: input.captures.length,
    extraidas: 0,
    nuevas: 0,
    duplicadas: 0,
    transferencias: 0,
    error: null,
  };
  await deps.ingest.saveRun(run);

  let sinReferencia = 0;

  try {
    await ensureSystemAccounts(deps.accounts, input.owner);
    const cuentaActivo = await ensureSourceAccount(deps.accounts, input.owner, {
      fuente: input.portalId,
      nombre: portal.nombre,
    });

    for (const captura of input.captures) {
      for (const normalizada of extraer(captura)) {
        run.extraidas += 1;

        if (normalizada.referencia === null || normalizada.referencia.trim().length === 0) {
          sinReferencia += 1;
          continue;
        }

        const existente = await deps.ingest.findObservationByOrigin(
          input.owner,
          normalizada.fuente,
          normalizada.referencia,
        );
        if (existente !== null) {
          run.duplicadas += 1;
          continue;
        }

        const id = ingestedTransactionId(normalizada.fuente, normalizada.referencia);
        const transaccion = toLedgerTransaction(normalizada, {
          owner: input.owner,
          assetAccountId: cuentaActivo,
          id,
        });
        await deps.transactions.save(transaccion);
        await deps.ingest.saveObservation({
          id: observationId(id, normalizada.fuente),
          transactionId: id,
          owner: input.owner,
          fuente: normalizada.fuente,
          referencia: normalizada.referencia,
          huella: fingerprintOf(normalizada),
          capturadoEn: captura.capturedAt,
          runId: run.id,
          crudo: normalizada,
        });
        run.nuevas += 1;
      }
    }
  } catch (error) {
    run.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    run.terminadoEn = deps.clock();
    await deps.ingest.saveRun(run);
  }

  return {
    runId: run.id,
    capturas: run.capturas,
    extraidas: run.extraidas,
    nuevas: run.nuevas,
    duplicadas: run.duplicadas,
    sinReferencia,
  };
}
