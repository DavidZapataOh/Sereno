import { and, asc, eq, gte, lte } from 'drizzle-orm';

import type { SnapshotRepository } from '@/domain/overview/snapshot-repository';
import { snapshot, type Snapshot } from '@/domain/overview/snapshot';
import { ownerId } from '@/domain/ledger/ids';
import type { CurrencyCode } from '@/domain/money/currency';

import type { Database } from './database';
import { net_worth_snapshots } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

const aSnapshot = (fila: typeof net_worth_snapshots.$inferSelect): Snapshot =>
  snapshot({
    owner: ownerId(fila.ownerId),
    dia: fila.dia,
    patrimonio: { amount: BigInt(fila.patrimonio), currency: fila.moneda as CurrencyCode },
    tasas: fila.tasas,
    tomadaEn: fila.tomadaEn,
  });

export function createDrizzleSnapshotRepository(db: Database): SnapshotRepository {
  return {
    guardar: (instantanea) =>
      asPromise(() => {
        db.insert(net_worth_snapshots)
          .values({
            ownerId: instantanea.owner,
            dia: instantanea.dia,
            patrimonio: instantanea.patrimonio.amount.toString(),
            moneda: instantanea.patrimonio.currency,
            tasas: instantanea.tasas,
            tomadaEn: instantanea.tomadaEn,
          })
          // Dos arranques el mismo día son un punto, no dos: la del día se
          // reemplaza. La última del día es la que más sabe.
          .onConflictDoUpdate({
            target: [net_worth_snapshots.ownerId, net_worth_snapshots.dia],
            set: {
              patrimonio: instantanea.patrimonio.amount.toString(),
              moneda: instantanea.patrimonio.currency,
              tasas: instantanea.tasas,
              tomadaEn: instantanea.tomadaEn,
            },
          })
          .run();
      }),

    serie: (owner, desde, hasta) =>
      asPromise(() =>
        db
          .select()
          .from(net_worth_snapshots)
          .where(
            and(
              eq(net_worth_snapshots.ownerId, owner),
              gte(net_worth_snapshots.dia, desde),
              lte(net_worth_snapshots.dia, hasta),
            ),
          )
          .orderBy(asc(net_worth_snapshots.dia))
          .all()
          .map(aSnapshot),
      ),
  };
}
