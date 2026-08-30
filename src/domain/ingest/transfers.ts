import type { AccountId, TransactionId } from '@/domain/ledger/ids';
import { isUnclassified } from '@/domain/ledger/system-accounts';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import { isNegative, negate, type Money } from '@/domain/money/money';
import { daysBetween } from '@/domain/time/colombia';

export interface TransferCandidate {
  transaction: Transaction;
  asset: AccountId;
  /** El apunte del activo, con signo: negativo sale, positivo entra. */
  amount: Money;
}

/**
 * Una transacción es candidata a lado de transferencia si tiene exactamente
 * dos apuntes: uno en una cuenta de activo y otro en «sin clasificar». Lo ya
 * clasificado, o lo que ya es una transferencia, no lo es.
 */
export function transferCandidateOf(t: Transaction): TransferCandidate | null {
  if (t.postings.length !== 2) return null;
  const sinClasificar = t.postings.find((p) => isUnclassified(p.accountId));
  const activo = t.postings.find((p) => !isUnclassified(p.accountId));
  if (sinClasificar === undefined || activo === undefined) return null;
  return { transaction: t, asset: activo.accountId, amount: activo.amount };
}

export interface TransferPair {
  salida: Transaction;
  entrada: Transaction;
}

export function pairKey(salida: TransactionId, entrada: TransactionId): string {
  return `${salida}|${entrada}`;
}

/**
 * Empareja salidas con entradas: mismo monto, distinta cuenta de activo, misma
 * moneda, dentro de la ventana. Cada transacción como máximo una vez; gana la
 * más cercana en fecha y, a igual distancia, la primera por id.
 */
export function findTransferPairs(
  transactions: Transaction[],
  opts: { ventanaDias: number; excluir: ReadonlySet<string> },
): TransferPair[] {
  const candidatos = transactions
    .map(transferCandidateOf)
    .filter((c): c is TransferCandidate => c !== null);
  const salidas = candidatos.filter((c) => isNegative(c.amount));
  const entradas = candidatos.filter((c) => !isNegative(c.amount));
  const usadas = new Set<TransactionId>();
  const pares: TransferPair[] = [];

  for (const salida of salidas) {
    const distanciaA = (e: TransferCandidate): number =>
      daysBetween(salida.transaction.fecha, e.transaction.fecha);
    const compatibles = entradas
      .filter((e) => !usadas.has(e.transaction.id))
      .filter((e) => e.asset !== salida.asset)
      .filter(
        (e) =>
          e.amount.currency === salida.amount.currency && e.amount.amount === -salida.amount.amount,
      )
      .filter((e) => distanciaA(e) <= opts.ventanaDias)
      .filter((e) => !opts.excluir.has(pairKey(salida.transaction.id, e.transaction.id)))
      .sort((a, b) => {
        const porDia = distanciaA(a) - distanciaA(b);
        return porDia !== 0 ? porDia : a.transaction.id.localeCompare(b.transaction.id);
      });

    const elegida = compatibles[0];
    if (elegida === undefined) continue;
    usadas.add(salida.transaction.id);
    usadas.add(elegida.transaction.id);
    pares.push({ salida: salida.transaction, entrada: elegida.transaction });
  }

  return pares;
}

/**
 * Funde el par en una transacción entre los dos activos.
 *
 * Conserva id, fecha y origen de la salida: es la que el banco de origen
 * asentó primero y la que tiene la referencia más estable.
 */
export function mergeAsTransfer(par: TransferPair): Transaction {
  const salida = transferCandidateOf(par.salida);
  const entrada = transferCandidateOf(par.entrada);
  if (salida === null || entrada === null) {
    throw new Error('Los dos lados deben ser candidatos a transferencia');
  }

  return createTransaction({
    id: par.salida.id,
    owner: par.salida.owner,
    fecha: par.salida.fecha,
    descripcion: 'Transferencia entre cuentas',
    origen: par.salida.origen,
    postings: [
      { accountId: salida.asset, amount: salida.amount },
      { accountId: entrada.asset, amount: negate(salida.amount) },
    ],
  });
}
