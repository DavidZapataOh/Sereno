import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { normalizedTransactionSchema } from '@/domain/capture/normalized-transaction';
import type { IngestRepository } from '@/domain/ingest/ingest-repository';
import type { IngestRun } from '@/domain/ingest/ingest-run';
import type { Observation } from '@/domain/ingest/observation';
import { transactionId, type OwnerId } from '@/domain/ledger/ids';

import type { Database } from './database';
import { ingestRuns, transactionObservations } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

type RunRow = typeof ingestRuns.$inferSelect;
type ObservationRow = typeof transactionObservations.$inferSelect;

function toRun(fila: RunRow): IngestRun {
  return {
    id: fila.id,
    owner: fila.ownerId as OwnerId,
    fuente: fila.fuente,
    iniciadoEn: fila.iniciadoEn,
    terminadoEn: fila.terminadoEn,
    capturas: fila.capturas,
    extraidas: fila.extraidas,
    nuevas: fila.nuevas,
    duplicadas: fila.duplicadas,
    fusionadas: fila.fusionadas,
    omitidas: fila.omitidas,
    anteriores: fila.anteriores,
    transferencias: fila.transferencias,
    error: fila.error,
  };
}

/**
 * Frontera de confianza: el crudo se valida al leer con el mismo esquema con
 * el que se aceptó al capturar. Un JSON corrupto falla aquí, con el id de la
 * observación, y no tres capas más arriba.
 */
function toObservation(fila: ObservationRow): Observation {
  const crudo = normalizedTransactionSchema.parse(JSON.parse(fila.crudo));
  return {
    id: fila.id,
    transactionId: transactionId(fila.transactionId),
    owner: fila.ownerId as OwnerId,
    fuente: fila.fuente,
    canal: fila.canal,
    referencia: fila.referencia,
    huella: fila.huella,
    capturadoEn: fila.capturadoEn,
    runId: fila.runId,
    crudo,
  };
}

export function createDrizzleIngestRepository(db: Database): IngestRepository {
  return {
    saveRun: (run) =>
      asPromise(() => {
        const fila = {
          id: run.id,
          ownerId: run.owner,
          fuente: run.fuente,
          iniciadoEn: run.iniciadoEn,
          terminadoEn: run.terminadoEn,
          capturas: run.capturas,
          extraidas: run.extraidas,
          nuevas: run.nuevas,
          duplicadas: run.duplicadas,
          fusionadas: run.fusionadas,
          omitidas: run.omitidas,
          anteriores: run.anteriores,
          transferencias: run.transferencias,
          error: run.error,
        };
        db.insert(ingestRuns)
          .values(fila)
          .onConflictDoUpdate({ target: ingestRuns.id, set: fila })
          .run();
      }),

    findLastRun: (owner, fuente) =>
      asPromise(() => {
        const [fila] = db
          .select()
          .from(ingestRuns)
          .where(and(eq(ingestRuns.ownerId, owner), eq(ingestRuns.fuente, fuente)))
          .orderBy(desc(ingestRuns.iniciadoEn))
          .limit(1)
          .all();
        return fila === undefined ? null : toRun(fila);
      }),

    findFirstRun: (owner, fuente) =>
      asPromise(() => {
        const [fila] = db
          .select()
          .from(ingestRuns)
          .where(and(eq(ingestRuns.ownerId, owner), eq(ingestRuns.fuente, fuente)))
          .orderBy(asc(ingestRuns.iniciadoEn))
          .limit(1)
          .all();
        return fila === undefined ? null : toRun(fila);
      }),

    saveObservation: (o) =>
      asPromise(() => {
        const fila = {
          id: o.id,
          transactionId: o.transactionId,
          ownerId: o.owner,
          fuente: o.fuente,
          referencia: o.referencia,
          huella: o.huella,
          capturadoEn: o.capturadoEn,
          runId: o.runId,
          crudo: JSON.stringify(o.crudo),
        };
        db.insert(transactionObservations)
          .values(fila)
          .onConflictDoUpdate({ target: transactionObservations.id, set: fila })
          .run();
      }),

    findObservationByOrigin: (owner, fuente, referencia) =>
      asPromise(() => {
        const [fila] = db
          .select()
          .from(transactionObservations)
          .where(
            and(
              eq(transactionObservations.ownerId, owner),
              eq(transactionObservations.fuente, fuente),
              eq(transactionObservations.referencia, referencia),
            ),
          )
          .limit(1)
          .all();
        return fila === undefined ? null : toObservation(fila);
      }),

    findObservationsByFingerprint: (owner, huellas) =>
      asPromise(() => {
        if (huellas.length === 0) return [];
        return db
          .select()
          .from(transactionObservations)
          .where(
            and(
              eq(transactionObservations.ownerId, owner),
              inArray(transactionObservations.huella, huellas),
            ),
          )
          .all()
          .map(toObservation);
      }),

    listObservations: (id) =>
      asPromise(() =>
        db
          .select()
          .from(transactionObservations)
          .where(eq(transactionObservations.transactionId, id))
          .orderBy(transactionObservations.capturadoEn)
          .all()
          .map(toObservation),
      ),

    deleteObservation: (id) =>
      asPromise(() => {
        db.delete(transactionObservations).where(eq(transactionObservations.id, id)).run();
      }),
  };
}
