import { and, desc, eq, gte, inArray, lt, lte, or, type SQL } from 'drizzle-orm';

import { accountId, transactionId, type OwnerId, type TransactionId } from '@/domain/ledger/ids';
import { createTransaction, type Posting, type Transaction } from '@/domain/ledger/transaction';
import type {
  ListOptions,
  Page,
  TransactionFilter,
  TransactionRepository,
} from '@/domain/ledger/transaction-repository';

import { mesDe } from '@/domain/ledger/balance-checkpoint';

import type { Database } from './database';
import { toMoney } from './mappers';
import { balanceCheckpoints, postings, transactions } from './schema';

const LIMITE_POR_DEFECTO = 50;

/**
 * Borra los cortes que un cambio deja mintiendo.
 *
 * Se borran **desde el mes afectado en adelante**, y de cada cuenta tocada. No
 * se ajustan: ajustar un corte es hacer aritmética sobre un caché, y basta una
 * cuenta mal hecha para que el saldo quede mal para siempre sin fallar nunca.
 *
 * Un movimiento con fecha vieja no es un caso raro: la ingesta trae correo con
 * retraso todos los días.
 */
function invalidarCortes(
  tx: { delete: Database['delete'] },
  tocados: readonly { accountId: string; fecha: string }[],
): void {
  const desdeCuenta = new Map<string, string>();
  for (const { accountId, fecha } of tocados) {
    const mes = mesDe(fecha);
    const actual = desdeCuenta.get(accountId);
    if (actual === undefined || mes < actual) desdeCuenta.set(accountId, mes);
  }

  for (const [cuenta, mes] of desdeCuenta) {
    tx.delete(balanceCheckpoints)
      .where(and(eq(balanceCheckpoints.accountId, cuenta), gte(balanceCheckpoints.mes, mes)))
      .run();
  }
}

class TransactionNotFoundError extends Error {
  constructor(id: TransactionId) {
    super(`No existe la transacción "${id}"`);
    this.name = 'TransactionNotFoundError';
  }
}

class InvalidCursorError extends Error {
  constructor(cursor: string) {
    super(`Cursor inválido: "${cursor}"`);
    this.name = 'InvalidCursorError';
  }
}

interface Cursor {
  fecha: string;
  id: string;
}

/**
 * El cursor es opaco a propósito.
 *
 * Si fuera legible, alguien acabaría construyéndolo a mano y la paginación
 * quedaría atada a la forma interna del índice. Va codificado para que la única
 * manera de obtener uno sea haberlo recibido.
 */
function codificarCursor(cursor: Cursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

function decodificarCursor(bruto: string): Cursor {
  let valor: unknown;
  try {
    valor = JSON.parse(decodeURIComponent(bruto));
  } catch {
    throw new InvalidCursorError(bruto);
  }
  if (
    typeof valor !== 'object' ||
    valor === null ||
    typeof (valor as Cursor).fecha !== 'string' ||
    typeof (valor as Cursor).id !== 'string'
  ) {
    throw new InvalidCursorError(bruto);
  }
  return valor as Cursor;
}

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

interface PostingRow {
  id: string;
  transactionId: string;
  accountId: string;
  amount: string;
  currency: string;
  nota: string | null;
}

interface TransactionRow {
  id: string;
  ownerId: string;
  fecha: string;
  descripcion: string;
  fuente: string;
  referencia: string | null;
}

/**
 * Implementación sobre Drizzle.
 *
 * Al leer, la transacción se reconstruye pasando por `createTransaction`: lo que
 * sale de la base cuadra o falla ruidosamente. Devolver un objeto sin validar
 * sería confiar en que nada tocó la base nunca por debajo.
 */
export function createDrizzleTransactionRepository(db: Database): TransactionRepository {
  const aPosting = (fila: PostingRow): Posting => ({
    accountId: accountId(fila.accountId),
    amount: toMoney(fila.amount, fila.currency),
    ...(fila.nota === null ? {} : { nota: fila.nota }),
  });

  const reconstruir = (fila: TransactionRow, apuntes: PostingRow[]): Transaction =>
    createTransaction({
      id: transactionId(fila.id),
      owner: fila.ownerId as OwnerId,
      fecha: fila.fecha,
      descripcion: fila.descripcion,
      origen: { fuente: fila.fuente, referencia: fila.referencia },
      postings: apuntes.map(aPosting),
    });

  const apuntesDe = (ids: string[]): Map<string, PostingRow[]> => {
    const agrupados = new Map<string, PostingRow[]>();
    if (ids.length === 0) return agrupados;

    // Se ordena por `id` para que el orden de los apuntes sea estable entre
    // lecturas: sin esto, dos lecturas de la misma transacción podrían devolver
    // los apuntes en distinto orden y romper comparaciones legítimas.
    const filas = db
      .select()
      .from(postings)
      .where(inArray(postings.transactionId, ids))
      .orderBy(postings.id)
      .all();

    filas.forEach((fila) => {
      const existentes = agrupados.get(fila.transactionId);
      if (existentes === undefined) agrupados.set(fila.transactionId, [fila]);
      else existentes.push(fila);
    });
    return agrupados;
  };

  const filtrosDe = (owner: OwnerId, filter?: TransactionFilter): SQL[] => {
    const condiciones: SQL[] = [eq(transactions.ownerId, owner)];

    if (filter?.desde !== undefined) condiciones.push(gte(transactions.fecha, filter.desde));
    if (filter?.hasta !== undefined) condiciones.push(lte(transactions.fecha, filter.hasta));
    if (filter?.fuente !== undefined) condiciones.push(eq(transactions.fuente, filter.fuente));
    if (filter?.accountId !== undefined) {
      condiciones.push(
        inArray(
          transactions.id,
          db
            .select({ id: postings.transactionId })
            .from(postings)
            .where(eq(postings.accountId, filter.accountId)),
        ),
      );
    }
    return condiciones;
  };

  return {
    save: (transaction) =>
      asPromise(() => {
        // Todo dentro de una sola transacción de base de datos: si un apunte
        // falla, no queda ni la cabecera ni los apuntes que ya habían entrado.
        db.transaction((tx) => {
          // **Lo que había antes también cuenta para invalidar** (ADR 0006).
          // Guardar es un reemplazo: si la transacción cambió de cuenta o de
          // fecha, los cortes de la cuenta vieja y del mes viejo se quedarían
          // mintiendo, y un saldo que miente sin fallar es lo peor que puede
          // pasar aquí.
          const anterior = tx
            .select({ accountId: postings.accountId, fecha: transactions.fecha })
            .from(postings)
            .innerJoin(transactions, eq(postings.transactionId, transactions.id))
            .where(eq(postings.transactionId, transaction.id))
            .all();

          tx.delete(transactions).where(eq(transactions.id, transaction.id)).run();
          tx.insert(transactions)
            .values({
              id: transaction.id,
              ownerId: transaction.owner,
              fecha: transaction.fecha,
              descripcion: transaction.descripcion,
              fuente: transaction.origen.fuente,
              referencia: transaction.origen.referencia,
            })
            .run();
          tx.insert(postings)
            .values(
              transaction.postings.map((posting, indice) => ({
                id: `${transaction.id}:${String(indice).padStart(4, '0')}`,
                transactionId: transaction.id,
                accountId: posting.accountId,
                amount: posting.amount.amount.toString(),
                currency: posting.amount.currency,
                nota: posting.nota ?? null,
              })),
            )
            .run();

          invalidarCortes(tx, [
            ...anterior.map((fila) => ({ accountId: fila.accountId, fecha: fila.fecha })),
            ...transaction.postings.map((posting) => ({
              accountId: posting.accountId,
              fecha: transaction.fecha,
            })),
          ]);
        });
      }),

    findById: (id) =>
      asPromise(() => {
        const [fila] = db.select().from(transactions).where(eq(transactions.id, id)).all();
        if (fila === undefined) return null;

        return reconstruir(fila, apuntesDe([fila.id]).get(fila.id) ?? []);
      }),

    list: (owner, filter, options?: ListOptions): Promise<Page<Transaction>> =>
      asPromise(() => {
        const limite = options?.limit ?? LIMITE_POR_DEFECTO;
        const condiciones = filtrosDe(owner, filter);

        if (options?.cursor !== undefined) {
          const cursor = decodificarCursor(options.cursor);
          // Orden descendente por (fecha, id): la siguiente página empieza justo
          // después del último visto. El desempate por `id` es lo que impide
          // repetir o saltarse filas cuando dos comparten fecha.
          condiciones.push(
            or(
              lt(transactions.fecha, cursor.fecha),
              and(eq(transactions.fecha, cursor.fecha), lt(transactions.id, cursor.id)),
            ) as SQL,
          );
        }

        // Se pide una fila de más para saber si hay página siguiente sin tener
        // que contar el total, que obligaría a recorrer todo el historial.
        const filas = db
          .select()
          .from(transactions)
          .where(and(...condiciones))
          .orderBy(desc(transactions.fecha), desc(transactions.id))
          .limit(limite + 1)
          .all();

        const hayMas = filas.length > limite;
        const pagina = hayMas ? filas.slice(0, limite) : filas;
        const apuntes = apuntesDe(pagina.map((fila) => fila.id));
        const ultima = pagina[pagina.length - 1];

        return {
          items: pagina.map((fila) => reconstruir(fila, apuntes.get(fila.id) ?? [])),
          nextCursor:
            hayMas && ultima !== undefined
              ? codificarCursor({ fecha: ultima.fecha, id: ultima.id })
              : null,
        };
      }),

    existsByOrigin: (owner, fuente, referencia) =>
      asPromise(() => {
        const [fila] = db
          .select({ id: transactions.id })
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, owner),
              eq(transactions.fuente, fuente),
              eq(transactions.referencia, referencia),
            ),
          )
          .limit(1)
          .all();

        return fila !== undefined;
      }),

    delete: (id) =>
      asPromise(() => {
        const [fila] = db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.id, id))
          .all();
        if (fila === undefined) throw new TransactionNotFoundError(id);

        db.transaction((tx) => {
          // Se leen antes de borrar: después ya no hay a quién preguntarle qué
          // cuentas y qué mes hay que invalidar.
          const afectados = tx
            .select({ accountId: postings.accountId, fecha: transactions.fecha })
            .from(postings)
            .innerJoin(transactions, eq(postings.transactionId, transactions.id))
            .where(eq(postings.transactionId, id))
            .all();

          // Los apuntes caen por la clave foránea en cascada del esquema.
          tx.delete(transactions).where(eq(transactions.id, id)).run();
          invalidarCortes(tx, afectados);
        });
      }),
  };
}
