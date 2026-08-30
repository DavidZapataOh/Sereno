import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { BatchRepository, ClassificationBatch } from '@/domain/categorization/batch';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';

import type { Database } from './database';
import { classificationBatches } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

/** Los cambios se guardan como JSON; al leer se validan: son datos, no confianza. */
const cambiosSchema = z.array(
  z.object({
    transactionId: z.string(),
    antes: z
      .object({
        categoria: z.string(),
        origen: z.enum(['manual', 'regla', 'aprendida', 'catalogo']),
        reglaId: z.string().nullable(),
        confianza: z.number().int(),
      })
      .nullable(),
    despues: z.string(),
  }),
);

const toBatch = (fila: typeof classificationBatches.$inferSelect): ClassificationBatch => ({
  id: fila.id,
  owner: ownerId(fila.ownerId),
  comercio: fila.comercio,
  cambios: cambiosSchema.parse(JSON.parse(fila.cambios)).map((c) => ({
    transactionId: transactionId(c.transactionId),
    antes: c.antes === null ? null : { ...c.antes, categoria: accountId(c.antes.categoria) },
    despues: accountId(c.despues),
  })),
  reglaId: fila.reglaId,
  creadoEn: fila.creadoEn,
  deshechoEn: fila.deshechoEn,
});

export function createDrizzleBatchRepository(db: Database): BatchRepository {
  return {
    save: (b) =>
      asPromise(() => {
        const fila = {
          id: b.id,
          ownerId: b.owner,
          comercio: b.comercio,
          cambios: JSON.stringify(b.cambios),
          reglaId: b.reglaId,
          creadoEn: b.creadoEn,
          deshechoEn: b.deshechoEn,
        };
        db.insert(classificationBatches)
          .values(fila)
          .onConflictDoUpdate({ target: classificationBatches.id, set: fila })
          .run();
      }),
    findById: (id) =>
      asPromise(() => {
        const [fila] = db
          .select()
          .from(classificationBatches)
          .where(eq(classificationBatches.id, id))
          .all();
        return fila === undefined ? null : toBatch(fila);
      }),
    findLatest: (owner) =>
      asPromise(() => {
        const [fila] = db
          .select()
          .from(classificationBatches)
          .where(
            and(eq(classificationBatches.ownerId, owner), isNull(classificationBatches.deshechoEn)),
          )
          .orderBy(desc(classificationBatches.creadoEn))
          .limit(1)
          .all();
        return fila === undefined ? null : toBatch(fila);
      }),
  };
}
