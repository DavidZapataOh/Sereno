import { and, eq, isNull } from 'drizzle-orm';

import type { Account } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { sum, type Money } from '@/domain/money/money';

import type { Database } from './database';
import { fromAccount, toAccount, toMoney } from './mappers';
import { accounts, postings } from './schema';

class AccountNotFoundError extends Error {
  constructor(id: AccountId) {
    super(`No existe la cuenta "${id}"`);
    this.name = 'AccountNotFoundError';
  }
}

/**
 * Envuelve una operación síncrona para que sus fallos lleguen como rechazo.
 *
 * Los drivers de Drizzle para SQLite son síncronos, pero el puerto promete
 * `Promise`. Sin esto un error saldría como excepción síncrona antes de que la
 * promesa exista, y el `.catch()` del llamante no lo vería nunca.
 */
function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Implementación sobre Drizzle.
 *
 * Recibe la base por parámetro en vez de importarla: así las pruebas usan una
 * base en memoria y el dispositivo la real, sin condicionales dentro.
 */
export function createDrizzleAccountRepository(db: Database): AccountRepository {
  const buscar = (id: AccountId): Account | null => {
    const [fila] = db.select().from(accounts).where(eq(accounts.id, id)).all();
    return fila === undefined ? null : toAccount(fila);
  };

  return {
    save: (account) =>
      asPromise(() => {
        const fila = fromAccount(account);
        db.insert(accounts)
          .values(fila)
          .onConflictDoUpdate({ target: accounts.id, set: fila })
          .run();
      }),

    findById: (id) => asPromise(() => buscar(id)),

    listByOwner: (owner: OwnerId, options) =>
      asPromise(() => {
        const filtro =
          options?.incluirArchivadas === true
            ? eq(accounts.ownerId, owner)
            : and(eq(accounts.ownerId, owner), isNull(accounts.archivedAt));

        return db.select().from(accounts).where(filtro).all().map(toAccount);
      }),

    balanceOf: (id): Promise<Money> =>
      asPromise(() => {
        // Se busca la cuenta antes de sumar por dos motivos: hace falta su
        // moneda para el saldo cero, y una cuenta inexistente debe fallar en vez
        // de devolver cero, que sería indistinguible de una cuenta vacía.
        const cuenta = buscar(id);
        if (cuenta === null) throw new AccountNotFoundError(id);

        const apuntes = db
          .select({ amount: postings.amount, currency: postings.currency })
          .from(postings)
          .where(eq(postings.accountId, id))
          .all();

        // `sum` usa `add`, que rechaza mezclar monedas: si un apunte llegó con
        // una moneda distinta a la de la cuenta, salta aquí en vez de producir
        // un saldo que no significa nada.
        return sum(
          apuntes.map((apunte) => toMoney(apunte.amount, apunte.currency)),
          cuenta.currency,
        );
      }),

    archive: (id, fecha) =>
      asPromise(() => {
        if (buscar(id) === null) throw new AccountNotFoundError(id);

        db.update(accounts).set({ archivedAt: fecha }).where(eq(accounts.id, id)).run();
      }),
  };
}
