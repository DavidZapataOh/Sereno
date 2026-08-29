import type { CurrencyCode } from '@/domain/money/currency';
import { isZero, sum, type Money } from '@/domain/money/money';

import type { Account } from './account';
import type { AccountId } from './ids';
import { currenciesOf, imbalanceOf, type Posting, type Transaction } from './transaction';

export interface LedgerViolation {
  /** Nombre de la invariante rota, para poder agrupar y contar. */
  invariante: string;
  /** Qué se rompió exactamente, con los identificadores necesarios para ir a mirarlo. */
  detalle: string;
}

export interface LedgerSnapshot {
  transactions: readonly Transaction[];
  accounts: readonly Account[];
}

const describir = (montos: readonly Money[]): string =>
  montos.map((m) => `${m.currency}: ${m.amount.toString()}`).join(', ');

/**
 * Toda transacción cuadra por moneda.
 *
 * Es la misma comprobación que hace `createTransaction`, pero aplicada a lo que
 * ya está guardado. Lo que entró bien pudo corromperse después.
 */
export function checkTransactionsBalance(transactions: readonly Transaction[]): LedgerViolation[] {
  return transactions.flatMap((transaction) => {
    const descuadre = imbalanceOf(transaction.postings);
    return descuadre.length === 0
      ? []
      : [
          {
            invariante: 'transaccion-cuadrada',
            detalle: `La transacción "${transaction.id}" no cuadra — ${describir(descuadre)}`,
          },
        ];
  });
}

/**
 * Toda transacción tiene al menos dos apuntes.
 *
 * No es redundante con el cuadre: una transacción sin apuntes cuadra —la suma de
 * nada es cero— y una con un solo apunte de importe cero también. `createTransaction`
 * lo impide al construir, pero si los apuntes se pierden después, ninguna otra
 * invariante lo ve.
 */
export function checkTransactionShape(transactions: readonly Transaction[]): LedgerViolation[] {
  return transactions.flatMap((transaction) =>
    transaction.postings.length >= 2
      ? []
      : [
          {
            invariante: 'transaccion-con-dos-apuntes',
            detalle: `La transacción "${transaction.id}" tiene ${String(transaction.postings.length)} apunte(s); una transacción necesita al menos dos`,
          },
        ],
  );
}

/**
 * La suma de TODOS los apuntes es cero, por moneda.
 *
 * Es la ecuación contable. Cada transacción puede cuadrar por separado y aun así
 * fallar esto si un apunte suelto entró sin pareja, así que no es redundante con
 * la comprobación anterior.
 */
export function checkGlobalBalance(postings: readonly Posting[]): LedgerViolation[] {
  return currenciesOf(postings).flatMap((currency) => {
    const total = sum(
      postings.filter((posting) => posting.amount.currency === currency).map((p) => p.amount),
      currency,
    );
    return isZero(total)
      ? []
      : [
          {
            invariante: 'suma-global-cero',
            detalle: `La suma de todos los apuntes en ${currency} es ${total.amount.toString()}, debería ser 0`,
          },
        ];
  });
}

/** Todo apunte referencia una cuenta que existe. */
export function checkAccountsExist(
  postings: readonly Posting[],
  accounts: readonly Account[],
): LedgerViolation[] {
  const existentes = new Set<AccountId>(accounts.map((account) => account.id));
  const faltantes = new Set<AccountId>(
    postings.map((posting) => posting.accountId).filter((id) => !existentes.has(id)),
  );

  return [...faltantes].map((id) => ({
    invariante: 'cuenta-existe',
    detalle: `Hay apuntes contra la cuenta "${id}", que no existe`,
  }));
}

/**
 * Un apunte no puede estar en una moneda distinta a la de su cuenta.
 *
 * Sin esto, un saldo puede quedar en dos monedas a la vez y la pregunta «cuánto
 * hay en esta cuenta» deja de tener una sola respuesta.
 */
export function checkPostingCurrencies(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
): LedgerViolation[] {
  const monedaDe = new Map<AccountId, CurrencyCode>(
    accounts.map((account) => [account.id, account.currency]),
  );

  return transactions.flatMap((transaction) =>
    transaction.postings.flatMap((posting) => {
      const esperada = monedaDe.get(posting.accountId);
      return esperada === undefined || esperada === posting.amount.currency
        ? []
        : [
            {
              invariante: 'moneda-del-apunte',
              detalle: `La transacción "${transaction.id}" tiene un apunte en ${posting.amount.currency} contra la cuenta "${posting.accountId}", que es en ${esperada}`,
            },
          ];
    }),
  );
}

/**
 * Todas las invariantes de una vez.
 *
 * Devuelve la lista completa en vez de parar en la primera: cuando algo se
 * rompe, saber si falló una transacción o mil es la diferencia entre un dato
 * corrupto y un fallo sistemático.
 */
export function checkAllInvariants(snapshot: LedgerSnapshot): LedgerViolation[] {
  const apuntes = snapshot.transactions.flatMap((transaction) => [...transaction.postings]);

  return [
    ...checkTransactionShape(snapshot.transactions),
    ...checkTransactionsBalance(snapshot.transactions),
    ...checkGlobalBalance(apuntes),
    ...checkAccountsExist(apuntes, snapshot.accounts),
    ...checkPostingCurrencies(snapshot.transactions, snapshot.accounts),
  ];
}
