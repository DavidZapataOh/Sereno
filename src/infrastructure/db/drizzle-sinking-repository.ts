import { eq } from 'drizzle-orm';

import { accountId, ownerId } from '@/domain/ledger/ids';
import type { CurrencyCode } from '@/domain/money/currency';
import {
  createSinkingFund,
  type SinkingFund,
  type TipoDeFondo,
} from '@/domain/sinking/sinking-fund';
import type { SinkingRepository } from '@/domain/sinking/sinking-repository';

import type { Database } from './database';
import { sinking_funds } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

const aFondo = (fila: typeof sinking_funds.$inferSelect): SinkingFund =>
  createSinkingFund({
    accountId: accountId(fila.accountId),
    owner: ownerId(fila.ownerId),
    nombre: fila.nombre,
    tipo: fila.tipo as TipoDeFondo,
    objetivo: { amount: BigInt(fila.objetivo), currency: fila.moneda as CurrencyCode },
    proximaFecha: fila.proximaFecha,
    cadaMeses: fila.cadaMeses,
  });

export function createDrizzleSinkingRepository(db: Database): SinkingRepository {
  const fila = (fondo: SinkingFund) => ({
    accountId: fondo.accountId,
    ownerId: fondo.owner,
    nombre: fondo.nombre,
    objetivo: fondo.objetivo.amount.toString(),
    moneda: fondo.objetivo.currency,
    proximaFecha: fondo.proximaFecha,
    cadaMeses: fondo.cadaMeses,
    tipo: fondo.tipo,
  });

  return {
    guardar: (fondo) =>
      asPromise(() => {
        const valores = fila(fondo);
        db.insert(sinking_funds)
          .values(valores)
          .onConflictDoUpdate({ target: sinking_funds.accountId, set: valores })
          .run();
      }),
    buscar: (id) =>
      asPromise(() => {
        const f = db.select().from(sinking_funds).where(eq(sinking_funds.accountId, id)).get();
        return f === undefined ? null : aFondo(f);
      }),
    listar: (owner) =>
      asPromise(() =>
        db.select().from(sinking_funds).where(eq(sinking_funds.ownerId, owner)).all().map(aFondo),
      ),
    borrar: (id) =>
      asPromise(() => {
        db.delete(sinking_funds).where(eq(sinking_funds.accountId, id)).run();
      }),
  };
}
