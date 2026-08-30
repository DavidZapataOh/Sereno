import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { normalizedTransactionSchema } from '@/domain/capture/normalized-transaction';
import type { Observation } from '@/domain/ingest/observation';
import type { TransferRecord, TransferState } from '@/domain/ingest/transfer-record';
import type { TransferRepository } from '@/domain/ingest/transfer-repository';
import { pairKey } from '@/domain/ingest/transfers';
import { transactionId, type OwnerId } from '@/domain/ledger/ids';
import { parseTransaction, serializeTransaction } from '@/domain/ledger/transaction-codec';

import type { Database } from './database';
import { transfers } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

const observationSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  owner: z.string(),
  fuente: z.string(),
  referencia: z.string().nullable(),
  huella: z.string(),
  capturadoEn: z.string(),
  runId: z.string().nullable(),
  crudo: normalizedTransactionSchema,
});

type Row = typeof transfers.$inferSelect;

function toRecord(fila: Row): TransferRecord {
  const observaciones = z.array(observationSchema).parse(JSON.parse(fila.observacionesEntrada));
  return {
    id: fila.id,
    owner: fila.ownerId as OwnerId,
    transactionId: transactionId(fila.transactionId),
    salida: parseTransaction(fila.salida),
    entrada: parseTransaction(fila.entrada),
    observacionesEntrada: observaciones.map((o): Observation => ({
      ...o,
      transactionId: transactionId(o.transactionId),
      owner: o.owner as OwnerId,
    })),
    estado: fila.estado,
    detectadaEn: fila.detectadaEn,
    resueltaEn: fila.resueltaEn,
  };
}

export function createDrizzleTransferRepository(db: Database): TransferRepository {
  return {
    save: (r) =>
      asPromise(() => {
        const fila = {
          id: r.id,
          ownerId: r.owner,
          transactionId: r.transactionId,
          salida: serializeTransaction(r.salida),
          entrada: serializeTransaction(r.entrada),
          observacionesEntrada: JSON.stringify(r.observacionesEntrada),
          estado: r.estado,
          detectadaEn: r.detectadaEn,
          resueltaEn: r.resueltaEn,
        };
        db.insert(transfers)
          .values(fila)
          .onConflictDoUpdate({ target: transfers.id, set: fila })
          .run();
      }),

    findById: (id) =>
      asPromise(() => {
        const [fila] = db.select().from(transfers).where(eq(transfers.id, id)).all();
        return fila === undefined ? null : toRecord(fila);
      }),

    findByTransaction: (id) =>
      asPromise(() => {
        const [fila] = db
          .select()
          .from(transfers)
          .where(eq(transfers.transactionId, id))
          .orderBy(desc(transfers.detectadaEn))
          .limit(1)
          .all();
        return fila === undefined ? null : toRecord(fila);
      }),

    listByOwner: (owner, estado?: TransferState) =>
      asPromise(() =>
        db
          .select()
          .from(transfers)
          .where(
            estado === undefined
              ? eq(transfers.ownerId, owner)
              : and(eq(transfers.ownerId, owner), eq(transfers.estado, estado)),
          )
          .orderBy(desc(transfers.detectadaEn))
          .all()
          .map(toRecord),
      ),

    undoneKeys: (owner) =>
      asPromise(
        () =>
          new Set(
            db
              .select()
              .from(transfers)
              .where(and(eq(transfers.ownerId, owner), eq(transfers.estado, 'deshecha')))
              .all()
              .map((fila) => {
                const r = toRecord(fila);
                return pairKey(r.salida.id, r.entrada.id);
              }),
          ),
      ),
  };
}
