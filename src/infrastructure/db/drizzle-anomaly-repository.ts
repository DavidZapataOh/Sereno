import { eq } from 'drizzle-orm';

import type { AnomalyRepository } from '@/domain/anomalies/anomaly-repository';

import type { Database } from './database';
import { dismissed_anomalies } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export function createDrizzleAnomalyRepository(db: Database): AnomalyRepository {
  return {
    descartar: (owner, id, cuando) =>
      asPromise(() => {
        db.insert(dismissed_anomalies)
          .values({ ownerId: owner, anomalyId: id, descartadaEn: cuando })
          // Descartar dos veces la misma no es un error: es tocar dos veces.
          .onConflictDoNothing()
          .run();
      }),

    descartadas: (owner) =>
      asPromise(
        () =>
          new Set(
            db
              .select()
              .from(dismissed_anomalies)
              .where(eq(dismissed_anomalies.ownerId, owner))
              .all()
              .map((f) => f.anomalyId),
          ),
      ),
  };
}
