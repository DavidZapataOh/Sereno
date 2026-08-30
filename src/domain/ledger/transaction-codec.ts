import { z } from 'zod';

import { getCurrency, type CurrencyCode } from '@/domain/money/currency';
import { money } from '@/domain/money/money';

import { accountId, ownerId, transactionId } from './ids';
import { createTransaction, type Transaction } from './transaction';

const postingSchema = z.object({
  accountId: z.string().min(1),
  amount: z.string().regex(/^-?(0|[1-9]\d*)$/),
  currency: z.string().refine((c) => getCurrency(c) !== undefined, 'moneda desconocida'),
  nota: z.string().optional(),
});

const transactionSchema = z.object({
  id: z.string().min(1),
  owner: z.string().min(1),
  fecha: z.string().min(1),
  descripcion: z.string(),
  origen: z.object({ fuente: z.string(), referencia: z.string().nullable() }),
  postings: z.array(postingSchema).min(2),
});

/**
 * `Transaction` a JSON.
 *
 * `JSON.stringify` no sabe serializar `bigint`: lanza. El monto va como texto,
 * igual que en la base de datos, por el mismo motivo.
 */
export function serializeTransaction(t: Transaction): string {
  return JSON.stringify({
    id: t.id,
    owner: t.owner,
    fecha: t.fecha,
    descripcion: t.descripcion,
    origen: t.origen,
    postings: t.postings.map((p) => ({
      accountId: p.accountId,
      amount: p.amount.amount.toString(),
      currency: p.amount.currency,
      ...(p.nota === undefined ? {} : { nota: p.nota }),
    })),
  });
}

/** JSON a `Transaction`, pasando por `createTransaction`: lo que sale cuadra o falla. */
export function parseTransaction(json: string): Transaction {
  const datos = transactionSchema.parse(JSON.parse(json));
  return createTransaction({
    id: transactionId(datos.id),
    owner: ownerId(datos.owner),
    fecha: datos.fecha,
    descripcion: datos.descripcion,
    origen: datos.origen,
    postings: datos.postings.map((p) => ({
      accountId: accountId(p.accountId),
      amount: money(BigInt(p.amount), p.currency as CurrencyCode),
      ...(p.nota === undefined ? {} : { nota: p.nota }),
    })),
  });
}
