import { desc, eq } from 'drizzle-orm';

import { accountId, type OwnerId } from '@/domain/ledger/ids';
import type { Reconciliation } from '@/domain/reconciliation/reconciliation';
import type { ReconciliationRepository } from '@/domain/reconciliation/reconciliation-repository';

import type { Database } from './database';
import { fromMoney, toMoney } from './mappers';
import { reconciliations } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

type Row = typeof reconciliations.$inferSelect;

function toReconciliation(fila: Row): Reconciliation {
  return {
    id: fila.id,
    owner: fila.ownerId as OwnerId,
    accountId: accountId(fila.accountId),
    fecha: fila.fecha,
    saldoReal: toMoney(fila.saldoReal, fila.currency),
    saldoCalculado: toMoney(fila.saldoCalculado, fila.currency),
    diferencia: toMoney(fila.diferencia, fila.currency),
    veredicto: fila.veredicto,
    fuente: fila.fuente,
    detalle: fila.detalle,
    creadoEn: fila.creadoEn,
  };
}

export function createDrizzleReconciliationRepository(db: Database): ReconciliationRepository {
  return {
    save: (r) =>
      asPromise(() => {
        const fila = {
          id: r.id,
          ownerId: r.owner,
          accountId: r.accountId,
          fecha: r.fecha,
          saldoReal: fromMoney(r.saldoReal),
          saldoCalculado: fromMoney(r.saldoCalculado),
          diferencia: fromMoney(r.diferencia),
          currency: r.saldoReal.currency,
          veredicto: r.veredicto,
          fuente: r.fuente,
          detalle: r.detalle,
          creadoEn: r.creadoEn,
        };
        db.insert(reconciliations)
          .values(fila)
          .onConflictDoUpdate({ target: reconciliations.id, set: fila })
          .run();
      }),

    findById: (id) =>
      asPromise(() => {
        const [fila] = db.select().from(reconciliations).where(eq(reconciliations.id, id)).all();
        return fila === undefined ? null : toReconciliation(fila);
      }),

    findLatest: (cuenta) =>
      asPromise(() => {
        const [fila] = db
          .select()
          .from(reconciliations)
          .where(eq(reconciliations.accountId, cuenta))
          .orderBy(desc(reconciliations.fecha))
          .limit(1)
          .all();
        return fila === undefined ? null : toReconciliation(fila);
      }),

    listByAccount: (cuenta) =>
      asPromise(() =>
        db
          .select()
          .from(reconciliations)
          .where(eq(reconciliations.accountId, cuenta))
          .orderBy(desc(reconciliations.fecha))
          .all()
          .map(toReconciliation),
      ),
  };
}
