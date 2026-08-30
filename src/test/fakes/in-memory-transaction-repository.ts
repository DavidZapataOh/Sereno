import type { OwnerId, TransactionId } from '@/domain/ledger/ids';
import type { Transaction } from '@/domain/ledger/transaction';
import type { Page, TransactionRepository } from '@/domain/ledger/transaction-repository';

import type { PostingConFecha } from './in-memory-account-repository';

export interface InMemoryTransactionRepository extends TransactionRepository {
  all: () => Transaction[];
}

/**
 * Doble del puerto de transacciones.
 *
 * Si se le pasa el arreglo `postings` del doble de cuentas, lo mantiene al
 * guardar y borrar, para que `balanceOf` de aquel refleje lo guardado aquí.
 */
export function createInMemoryTransactionRepository(
  postings: PostingConFecha[] = [],
): InMemoryTransactionRepository {
  const transacciones = new Map<TransactionId, Transaction>();

  const reconstruirApuntes = (): void => {
    postings.length = 0;
    transacciones.forEach((t) => {
      t.postings.forEach((p) => postings.push({ ...p, fecha: t.fecha }));
    });
  };

  return {
    all: () => [...transacciones.values()],

    save: (transaction) => {
      transacciones.set(transaction.id, transaction);
      reconstruirApuntes();
      return Promise.resolve();
    },

    findById: (id) => Promise.resolve(transacciones.get(id) ?? null),

    list: (owner: OwnerId, filter, options): Promise<Page<Transaction>> => {
      const limite = options?.limit ?? 50;
      const { desde, hasta, fuente, accountId } = filter ?? {};
      let items = [...transacciones.values()].filter((t) => t.owner === owner);
      if (desde !== undefined) items = items.filter((t) => t.fecha >= desde);
      if (hasta !== undefined) items = items.filter((t) => t.fecha <= hasta);
      if (fuente !== undefined) items = items.filter((t) => t.origen.fuente === fuente);
      if (accountId !== undefined) {
        items = items.filter((t) => t.postings.some((p) => p.accountId === accountId));
      }
      items.sort((a, b) =>
        a.fecha === b.fecha ? b.id.localeCompare(a.id) : b.fecha.localeCompare(a.fecha),
      );

      const inicio = options?.cursor === undefined ? 0 : Number(options.cursor);
      const pagina = items.slice(inicio, inicio + limite);
      const hayMas = inicio + limite < items.length;
      return Promise.resolve({
        items: pagina,
        nextCursor: hayMas ? String(inicio + limite) : null,
      });
    },

    existsByOrigin: (owner, fuente, referencia) =>
      Promise.resolve(
        [...transacciones.values()].some(
          (t) =>
            t.owner === owner && t.origen.fuente === fuente && t.origen.referencia === referencia,
        ),
      ),

    delete: (id) => {
      if (!transacciones.has(id)) {
        return Promise.reject(new Error(`No existe la transacción "${id}"`));
      }
      transacciones.delete(id);
      reconstruirApuntes();
      return Promise.resolve();
    },
  };
}
