import { and, eq } from 'drizzle-orm';

import type {
  Classification,
  ClassificationRepository,
} from '@/domain/categorization/classification';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';

import type { Database } from './database';
import { transactionClassifications } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

const toClassification = (
  fila: typeof transactionClassifications.$inferSelect,
): Classification => ({
  transactionId: transactionId(fila.transactionId),
  owner: ownerId(fila.ownerId),
  categoria: accountId(fila.categoria),
  origen: fila.origen,
  reglaId: fila.reglaId,
  confianza: fila.confianza,
  clasificadoEn: fila.clasificadoEn,
});

export function createDrizzleClassificationRepository(db: Database): ClassificationRepository {
  return {
    save: (c) =>
      asPromise(() => {
        const fila = {
          transactionId: c.transactionId,
          ownerId: c.owner,
          categoria: c.categoria,
          origen: c.origen,
          reglaId: c.reglaId,
          confianza: c.confianza,
          clasificadoEn: c.clasificadoEn,
        };
        db.insert(transactionClassifications)
          .values(fila)
          .onConflictDoUpdate({ target: transactionClassifications.transactionId, set: fila })
          .run();
      }),

    findByTransaction: (id) =>
      asPromise(() => {
        const [fila] = db
          .select()
          .from(transactionClassifications)
          .where(eq(transactionClassifications.transactionId, id))
          .all();
        return fila === undefined ? null : toClassification(fila);
      }),

    listByOwner: (owner, filter) =>
      asPromise(() =>
        db
          .select()
          .from(transactionClassifications)
          .where(
            filter?.origen === undefined
              ? eq(transactionClassifications.ownerId, owner)
              : and(
                  eq(transactionClassifications.ownerId, owner),
                  eq(transactionClassifications.origen, filter.origen),
                ),
          )
          .all()
          .map(toClassification),
      ),

    delete: (id) =>
      asPromise(() => {
        db.delete(transactionClassifications)
          .where(eq(transactionClassifications.transactionId, id))
          .run();
      }),
  };
}
