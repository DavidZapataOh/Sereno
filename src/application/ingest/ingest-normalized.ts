import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import {
  assignDerivedReferences,
  candidateFingerprints,
  chooseDuplicate,
  type MatchContext,
} from '@/domain/ingest/duplicates';
import { fingerprintOf } from '@/domain/ingest/fingerprint';
import type { IngestRun } from '@/domain/ingest/ingest-run';
import { observationId } from '@/domain/ingest/observation';
import { ingestedTransactionId, toLedgerTransaction } from '@/domain/ingest/to-transaction';
import type { OwnerId } from '@/domain/ledger/ids';
import type { PortalId } from '@/domain/portals/registry';

import { ensureSourceAccount, ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import type { IngestDeps, IngestSummary } from './types';

export interface NormalizedBatch {
  owner: OwnerId;
  fuente: PortalId;
  nombreFuente: string;
  lote: NormalizedTransaction[];
  /** Cuándo se obtuvo el lote. Va a cada observación. */
  capturadoEn: string;
  /** Cuántas capturas produjeron el lote, si vino de capturas. Para la corrida. */
  capturas?: number;
}

/**
 * Mete al ledger un lote de transacciones normalizadas, venga de donde venga.
 *
 * Para cada una, en orden:
 *  1. ¿Esta fuente ya la vio (misma referencia)? → duplicada, no se toca.
 *  2. ¿Otra fuente vio algo con huella compatible que esta fuente aún no
 *     vio? → fusionada: se añade una observación a esa transacción.
 *  3. Si no → nueva transacción con su observación.
 *
 * No hay transacción de base de datos alrededor del lote entero, a propósito.
 * Un lote que falla a mitad deja lo ya guardado, que es idempotente; la
 * corrida registra hasta dónde llegó y con qué error.
 */
export async function ingestNormalized(
  deps: IngestDeps,
  batch: NormalizedBatch,
): Promise<IngestSummary> {
  const run: IngestRun = {
    id: deps.ids.next(),
    owner: batch.owner,
    fuente: batch.fuente,
    iniciadoEn: deps.clock(),
    terminadoEn: null,
    capturas: batch.capturas ?? 0,
    extraidas: batch.lote.length,
    nuevas: 0,
    duplicadas: 0,
    fusionadas: 0,
    omitidas: 0,
    transferencias: 0,
    error: null,
  };
  await deps.ingest.saveRun(run);
  const motivosOmision: string[] = [];

  try {
    await ensureSystemAccounts(deps.accounts, batch.owner);
    const cuentaActivo = await ensureSourceAccount(deps.accounts, batch.owner, {
      fuente: batch.fuente,
      nombre: batch.nombreFuente,
    });

    for (const normalizada of assignDerivedReferences(batch.lote)) {
      const referencia = normalizada.referencia;
      // `assignDerivedReferences` garantiza referencia; el guard es para el tipo.
      if (referencia === null) continue;

      const vista = await deps.ingest.findObservationByOrigin(
        batch.owner,
        normalizada.fuente,
        referencia,
      );
      if (vista !== null) {
        run.duplicadas += 1;
        continue;
      }

      const observacionBase = {
        owner: batch.owner,
        fuente: normalizada.fuente,
        referencia,
        huella: fingerprintOf(normalizada),
        capturadoEn: batch.capturadoEn,
        runId: run.id,
        crudo: normalizada,
      };

      const candidatas = await deps.ingest.findObservationsByFingerprint(
        batch.owner,
        candidateFingerprints(normalizada),
      );
      const contextos: MatchContext[] = [];
      for (const candidata of candidatas) {
        const hermanas = await deps.ingest.listObservations(candidata.transactionId);
        contextos.push({
          observation: candidata,
          fuentesQueLaVieron: hermanas.map((o) => o.fuente),
        });
      }

      const duplicada = chooseDuplicate(normalizada, contextos);
      if (duplicada !== null) {
        await deps.ingest.saveObservation({
          ...observacionBase,
          id: observationId(duplicada.transactionId, normalizada.fuente),
          transactionId: duplicada.transactionId,
        });
        run.fusionadas += 1;
        continue;
      }

      const id = ingestedTransactionId(normalizada.fuente, referencia);
      // Una fila que no se puede convertir —monto cero, fecha inexistente— se
      // cuenta y se sigue. Que una fila informativa del banco tumbe el lote
      // entero es peor que omitirla; lo encontró la sesión de campo.
      let transaccion;
      try {
        transaccion = toLedgerTransaction(normalizada, {
          owner: batch.owner,
          assetAccountId: cuentaActivo,
          id,
        });
      } catch (error) {
        run.omitidas += 1;
        if (motivosOmision.length < 5) {
          const motivo = error instanceof Error ? error.message : String(error);
          motivosOmision.push(`${referencia}: ${motivo}`);
        }
        continue;
      }
      await deps.transactions.save(transaccion);
      await deps.ingest.saveObservation({
        ...observacionBase,
        id: observationId(id, normalizada.fuente),
        transactionId: id,
      });
      run.nuevas += 1;
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
    fusionadas: run.fusionadas,
    omitidas: run.omitidas,
    motivosOmision,
  };
}
