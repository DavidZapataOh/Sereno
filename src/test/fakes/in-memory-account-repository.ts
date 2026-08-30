import type { Account } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId } from '@/domain/ledger/ids';
import type { Posting } from '@/domain/ledger/transaction';
import { sum, type Money } from '@/domain/money/money';

/** Un apunte con la fecha de su transacción, para poder calcular saldos a una fecha. */
export type PostingConFecha = Posting & { fecha: string };

export interface InMemoryAccountRepository extends AccountRepository {
  all: () => Account[];
  /**
   * Con `hasta`, solo los apuntes de transacciones con esa fecha o anterior.
   * El puerto real lo gana en el plan 04; el doble lo tiene desde ya.
   */
  balanceOf: (id: AccountId, options?: { hasta?: string }) => Promise<Money>;
  /** Los apuntes que el doble usa para derivar saldos. Lo alimenta el doble de transacciones. */
  postings: PostingConFecha[];
}

/**
 * Doble del puerto de cuentas.
 *
 * Deriva el saldo de `postings`, igual que el real deriva de la tabla. Para
 * que un caso de uso vea saldos coherentes, el doble de transacciones recibe
 * este arreglo y lo mantiene.
 */
export function createInMemoryAccountRepository(): InMemoryAccountRepository {
  const cuentas = new Map<AccountId, Account>();
  const postings: PostingConFecha[] = [];

  return {
    postings,
    all: () => [...cuentas.values()],

    save: (account) => {
      cuentas.set(account.id, { ...account });
      return Promise.resolve();
    },

    findById: (id) => Promise.resolve(cuentas.get(id) ?? null),

    listByOwner: (owner, options) =>
      Promise.resolve(
        [...cuentas.values()].filter(
          (c) =>
            c.owner === owner && (options?.incluirArchivadas === true || c.archivedAt === null),
        ),
      ),

    balanceOf: (id, options?: { hasta?: string }): Promise<Money> => {
      const cuenta = cuentas.get(id);
      if (cuenta === undefined) return Promise.reject(new Error(`No existe la cuenta "${id}"`));
      const hasta = options?.hasta;
      return Promise.resolve(
        sum(
          postings
            .filter((p) => p.accountId === id && (hasta === undefined || p.fecha <= hasta))
            .map((p) => p.amount),
          cuenta.currency,
        ),
      );
    },

    archive: (id, fecha) => {
      const cuenta = cuentas.get(id);
      if (cuenta === undefined) return Promise.reject(new Error(`No existe la cuenta "${id}"`));
      cuentas.set(id, { ...cuenta, archivedAt: fecha });
      return Promise.resolve();
    },
  };
}
