import { eq } from 'drizzle-orm';

import type { CreditCard } from '@/domain/cards/card';
import type { CardRepository } from '@/domain/cards/card-repository';
import { accountId, ownerId } from '@/domain/ledger/ids';
import type { CurrencyCode } from '@/domain/money/currency';
import { money } from '@/domain/money/money';

import type { Database } from './database';
import { creditCards } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

/** El cupo vuelve a `bigint` desde el texto: nunca pasa por `number`. */
const toCard = (fila: typeof creditCards.$inferSelect): CreditCard => ({
  accountId: accountId(fila.accountId),
  owner: ownerId(fila.ownerId),
  cupo: money(BigInt(fila.cupo), fila.currency as CurrencyCode),
  diaDeCorte: fila.diaDeCorte,
  diaDePago: fila.diaDePago,
});

export function createDrizzleCardRepository(db: Database): CardRepository {
  const fila = (card: CreditCard) => ({
    accountId: card.accountId,
    ownerId: card.owner,
    cupo: card.cupo.amount.toString(),
    currency: card.cupo.currency,
    diaDeCorte: card.diaDeCorte,
    diaDePago: card.diaDePago,
  });

  return {
    save: (card) =>
      asPromise(() => {
        const valores = fila(card);
        db.insert(creditCards)
          .values(valores)
          .onConflictDoUpdate({ target: creditCards.accountId, set: valores })
          .run();
      }),

    find: (id) =>
      asPromise(() => {
        const [f] = db.select().from(creditCards).where(eq(creditCards.accountId, id)).all();
        return f === undefined ? null : toCard(f);
      }),

    listByOwner: (owner) =>
      asPromise(() =>
        db.select().from(creditCards).where(eq(creditCards.ownerId, owner)).all().map(toCard),
      ),
  };
}
