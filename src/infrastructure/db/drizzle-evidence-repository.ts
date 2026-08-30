import { and, eq, gt, inArray, sql } from 'drizzle-orm';

import type { EvidenceRepository } from '@/domain/categorization/evidence-repository';
import type { Evidence } from '@/domain/categorization/naive-bayes';
import { accountId, type AccountId } from '@/domain/ledger/ids';

import type { Database } from './database';
import { classifierEvidence } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export function createDrizzleEvidenceRepository(db: Database): EvidenceRepository {
  return {
    add: (owner, features, categoria, delta) =>
      asPromise(() => {
        db.transaction((tx) => {
          for (const feature of features) {
            tx.insert(classifierEvidence)
              .values({ ownerId: owner, feature, categoria, cuenta: Math.max(0, delta) })
              .onConflictDoUpdate({
                target: [
                  classifierEvidence.ownerId,
                  classifierEvidence.feature,
                  classifierEvidence.categoria,
                ],
                set: { cuenta: sql`MAX(0, ${classifierEvidence.cuenta} + ${delta})` },
              })
              .run();
          }
        });
      }),

    listByFeatures: (owner, features) =>
      asPromise((): Evidence[] => {
        // `IN ()` vacío es un error de SQLite: sin rasgos no hay consulta.
        if (features.length === 0) return [];
        return db
          .select()
          .from(classifierEvidence)
          .where(
            and(
              eq(classifierEvidence.ownerId, owner),
              inArray(classifierEvidence.feature, [...features]),
              gt(classifierEvidence.cuenta, 0),
            ),
          )
          .all()
          .map((f) => ({
            feature: f.feature,
            categoria: accountId(f.categoria),
            cuenta: f.cuenta,
          }));
      }),

    countByCategory: (owner) =>
      asPromise(() => {
        const filas = db
          .select({
            categoria: classifierEvidence.categoria,
            total: sql<number>`SUM(${classifierEvidence.cuenta})`,
          })
          .from(classifierEvidence)
          .where(eq(classifierEvidence.ownerId, owner))
          .groupBy(classifierEvidence.categoria)
          .all();
        return new Map<AccountId, number>(filas.map((f) => [accountId(f.categoria), f.total]));
      }),

    vocabularySize: (owner) =>
      asPromise(() => {
        const [fila] = db
          .select({ n: sql<number>`COUNT(DISTINCT ${classifierEvidence.feature})` })
          .from(classifierEvidence)
          .where(and(eq(classifierEvidence.ownerId, owner), gt(classifierEvidence.cuenta, 0)))
          .all();
        return fila?.n ?? 0;
      }),
  };
}
