import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';

import type { Account } from '@/domain/ledger/account';
import { mesUtilizableHasta } from '@/domain/ledger/balance-checkpoint';
import { finDeMes } from '@/domain/time/month';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { sum, type Money } from '@/domain/money/money';

import type { Database } from './database';
import { fromAccount, toAccount, toMoney } from './mappers';
import { accounts, balanceCheckpoints, postings, transactions } from './schema';

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

    balanceOf: (id, options): Promise<Money> =>
      asPromise(() => {
        // Se busca la cuenta antes de sumar por dos motivos: hace falta su
        // moneda para el saldo cero, y una cuenta inexistente debe fallar en vez
        // de devolver cero, que sería indistinguible de una cuenta vacía.
        const cuenta = buscar(id);
        if (cuenta === null) throw new AccountNotFoundError(id);

        // **Se parte del corte más reciente que sirva** (ADR 0006). Antes esto
        // sumaba el historial entero en cada llamada, y la pantalla de inicio
        // llama una vez por cuenta: abrir la app costaba el historial por cada
        // cuenta, y crecía cada mes sin techo.
        //
        // El corte es un caché: si no hay ninguno —o si se borran todos— este
        // camino calcula exactamente lo mismo, solo que leyendo más.
        const [corte] = db
          .select()
          .from(balanceCheckpoints)
          .where(
            options?.hasta === undefined
              ? eq(balanceCheckpoints.accountId, id)
              : and(
                  eq(balanceCheckpoints.accountId, id),
                  lte(balanceCheckpoints.mes, mesUtilizableHasta(options.hasta)),
                ),
          )
          .orderBy(desc(balanceCheckpoints.mes))
          .limit(1)
          .all();

        // La frontera del corte se compara como texto, igual que el resto de
        // las fechas del repositorio: es lo que garantiza que el corte y los
        // apuntes que se suman aparte partan el mismo conjunto sin solaparse
        // ni dejar hueco.
        const desde = corte === undefined ? undefined : finDeMes(corte.mes);

        // Con `hasta`, se une con la transacción para filtrar por su fecha. El
        // plan de ejecución sigue entrando por `idx_postings_account`.
        const condiciones = [eq(postings.accountId, id)];
        if (desde !== undefined) condiciones.push(gte(transactions.fecha, desde));
        if (options?.hasta !== undefined) condiciones.push(lte(transactions.fecha, options.hasta));

        const apuntes = db
          .select({ amount: postings.amount, currency: postings.currency })
          .from(postings)
          .innerJoin(transactions, eq(postings.transactionId, transactions.id))
          .where(and(...condiciones))
          .all();

        // `sum` usa `add`, que rechaza mezclar monedas: si un apunte llegó con
        // una moneda distinta a la de la cuenta, salta aquí en vez de producir
        // un saldo que no significa nada.
        const desdeElCorte = sum(
          apuntes.map((apunte) => toMoney(apunte.amount, apunte.currency)),
          cuenta.currency,
        );

        return corte === undefined
          ? desdeElCorte
          : sum([toMoney(corte.amount, corte.currency), desdeElCorte], cuenta.currency);
      }),

    archive: (id, fecha) =>
      asPromise(() => {
        if (buscar(id) === null) throw new AccountNotFoundError(id);

        db.update(accounts).set({ archivedAt: fecha }).where(eq(accounts.id, id)).run();
      }),
  };
}
