import { and, eq } from 'drizzle-orm';

import { createEnvelope, type Envelope } from '@/domain/budget/envelope';
import type { BudgetRepository } from '@/domain/budget/budget-repository';
import { ownerId } from '@/domain/ledger/ids';
import type { CurrencyCode } from '@/domain/money/currency';

import type { Database } from './database';
import { budget_envelopes } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

const aSobre = (fila: typeof budget_envelopes.$inferSelect): Envelope =>
  createEnvelope({
    owner: ownerId(fila.ownerId),
    mes: fila.mes,
    categoria: fila.categoria,
    asignado: { amount: BigInt(fila.asignado), currency: fila.moneda as CurrencyCode },
  });

export function createDrizzleBudgetRepository(db: Database): BudgetRepository {
  return {
    guardar: (sobre) =>
      asPromise(() => {
        const valores = {
          ownerId: sobre.owner,
          mes: sobre.mes,
          categoria: sobre.categoria,
          asignado: sobre.asignado.amount.toString(),
          moneda: sobre.asignado.currency,
        };
        db.insert(budget_envelopes)
          .values(valores)
          .onConflictDoUpdate({
            target: [budget_envelopes.ownerId, budget_envelopes.mes, budget_envelopes.categoria],
            set: { asignado: valores.asignado, moneda: valores.moneda },
          })
          .run();
      }),

    listar: (owner, mes) =>
      asPromise(() =>
        db
          .select()
          .from(budget_envelopes)
          .where(and(eq(budget_envelopes.ownerId, owner), eq(budget_envelopes.mes, mes)))
          .all()
          .map(aSobre),
      ),

    borrar: (owner, mes, categoria) =>
      asPromise(() => {
        db.delete(budget_envelopes)
          .where(
            and(
              eq(budget_envelopes.ownerId, owner),
              eq(budget_envelopes.mes, mes),
              eq(budget_envelopes.categoria, categoria),
            ),
          )
          .run();
      }),
  };
}
