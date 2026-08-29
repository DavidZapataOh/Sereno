import type { CurrencyCode } from '@/domain/money/currency';
import { isNegative, isZero, money, sum, type Money } from '@/domain/money/money';
import type { AccountId, OwnerId, TransactionId } from './ids';

export interface Posting {
  accountId: AccountId;
  /** Con signo. Positivo es débito; negativo, crédito. */
  amount: Money;
  nota?: string;
}

export interface TransactionOrigin {
  /** De dónde vino el dato: webview, correo, manual, binance… */
  fuente: string;
  /** Referencia en el origen, para poder auditar y deduplicar. */
  referencia: string | null;
}

export interface Transaction {
  id: TransactionId;
  owner: OwnerId;
  /** ISO 8601 con zona. */
  fecha: string;
  descripcion: string;
  postings: readonly Posting[];
  origen: TransactionOrigin;
}

export class UnbalancedTransactionError extends Error {
  constructor(readonly imbalance: Money[]) {
    const detalle = imbalance.map((m) => `${m.currency}: ${m.amount.toString()}`).join(', ');
    super(`La transacción no cuadra. Descuadre por moneda — ${detalle}`);
    this.name = 'UnbalancedTransactionError';
  }
}

export function currenciesOf(postings: readonly Posting[]): CurrencyCode[] {
  return [...new Set(postings.map((posting) => posting.amount.currency))];
}

/**
 * Descuadre por moneda.
 *
 * La invariante de la doble partida es que la suma de los apuntes sea cero. Con
 * varias monedas se aplica **por moneda**: una conversión de divisa usa una
 * cuenta puente para que cada lado cuadre por separado.
 */
export function imbalanceOf(postings: readonly Posting[]): Money[] {
  return currenciesOf(postings)
    .map((currency) =>
      sum(
        postings.filter((p) => p.amount.currency === currency).map((p) => p.amount),
        currency,
      ),
    )
    .filter((total) => !isZero(total));
}

interface CreateTransactionInput {
  id: TransactionId;
  owner: OwnerId;
  fecha: string;
  descripcion: string;
  postings: readonly Posting[];
  origen: TransactionOrigin;
}

/**
 * Única forma de construir una transacción.
 *
 * Valida antes de devolver, así que en el resto del sistema una `Transaction`
 * cuadra por construcción y nadie tiene que volver a comprobarlo.
 */
export function createTransaction(input: CreateTransactionInput): Transaction {
  if (input.postings.length < 2) {
    throw new Error('Una transacción necesita al menos dos apuntes');
  }
  if (input.descripcion.trim().length === 0) {
    throw new Error('La transacción necesita una descripción');
  }
  if (Number.isNaN(Date.parse(input.fecha))) {
    throw new Error(`Fecha inválida: ${input.fecha}`);
  }

  const imbalance = imbalanceOf(input.postings);
  if (imbalance.length > 0) throw new UnbalancedTransactionError(imbalance);

  return {
    ...input,
    descripcion: input.descripcion.trim(),
    postings: [...input.postings],
  };
}

interface TransferInput {
  id: TransactionId;
  owner: OwnerId;
  fecha: string;
  descripcion: string;
  desde: AccountId;
  hacia: AccountId;
  amount: Money;
  origen: TransactionOrigin;
}

/**
 * Atajo para el caso más común: mover un monto de una cuenta a otra.
 *
 * El monto se pasa siempre positivo: la dirección la marcan `desde` y `hacia`.
 * Aceptar un monto negativo permitiría expresar lo mismo de dos formas, y dos
 * formas de decir lo mismo acaban significando cosas distintas.
 */
export function transfer(input: TransferInput): Transaction {
  if (isNegative(input.amount) || isZero(input.amount)) {
    throw new Error('El monto de una transferencia debe ser positivo');
  }
  if (input.desde === input.hacia) {
    throw new Error('No se puede transferir a la misma cuenta');
  }

  return createTransaction({
    id: input.id,
    owner: input.owner,
    fecha: input.fecha,
    descripcion: input.descripcion,
    origen: input.origen,
    postings: [
      { accountId: input.desde, amount: money(-input.amount.amount, input.amount.currency) },
      { accountId: input.hacia, amount: input.amount },
    ],
  });
}
