import { eq } from 'drizzle-orm';

import type { Debt, TipoDeDeuda, TipoDeTasa } from '@/domain/debt/debt';
import { createDebt } from '@/domain/debt/debt';
import type { DebtRepository } from '@/domain/debt/debt-repository';
import { accountId, ownerId } from '@/domain/ledger/ids';

import type { Database } from './database';
import { debts } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

const aDeuda = (fila: typeof debts.$inferSelect): Debt =>
  createDebt({
    accountId: accountId(fila.accountId),
    owner: ownerId(fila.ownerId),
    tipo: fila.tipo as TipoDeDeuda,
    nombre: fila.nombre,
    // `null` es «no aplica»; cero es una tasa pactada del 0 %. Se distinguen.
    tasa:
      fila.tasaValor === null || fila.tasaTipo === null
        ? null
        : { valor: Number(fila.tasaValor), tipo: fila.tasaTipo as TipoDeTasa },
    cuotasTotales: fila.cuotasTotales,
    diaDePago: fila.diaDePago,
  });

export function createDrizzleDebtRepository(db: Database): DebtRepository {
  const fila = (deuda: Debt) => ({
    accountId: deuda.accountId,
    ownerId: deuda.owner,
    tipo: deuda.tipo,
    nombre: deuda.nombre,
    tasaValor: deuda.tasa === null ? null : String(deuda.tasa.valor),
    tasaTipo: deuda.tasa?.tipo ?? null,
    cuotasTotales: deuda.cuotasTotales,
    diaDePago: deuda.diaDePago,
  });

  return {
    guardar: (deuda) =>
      asPromise(() => {
        const valores = fila(deuda);
        db.insert(debts)
          .values(valores)
          .onConflictDoUpdate({ target: debts.accountId, set: valores })
          .run();
      }),

    buscar: (id) =>
      asPromise(() => {
        const encontrada = db.select().from(debts).where(eq(debts.accountId, id)).get();
        return encontrada === undefined ? null : aDeuda(encontrada);
      }),

    listar: (owner) =>
      asPromise(() => db.select().from(debts).where(eq(debts.ownerId, owner)).all().map(aDeuda)),

    borrar: (id) =>
      asPromise(() => {
        db.delete(debts).where(eq(debts.accountId, id)).run();
      }),
  };
}
