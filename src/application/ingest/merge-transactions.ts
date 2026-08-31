import { observationId } from '@/domain/ingest/observation';
import type { OwnerId, TransactionId } from '@/domain/ledger/ids';
import { isUnclassified } from '@/domain/ledger/system-accounts';
import type { Transaction } from '@/domain/ledger/transaction';

import type { IngestDeps } from './types';

const montoSinClasificar = (t: Transaction): bigint | null =>
  t.postings.find((p) => isUnclassified(p.accountId))?.amount.amount ?? null;

/**
 * Fusiona a mano dos transacciones que la heurística no emparejó.
 *
 * Reglas:
 *  - Deben ser el mismo monto, en la misma dirección.
 *  - Ninguna fuente puede haber visto las dos: si Bancolombia dio dos
 *    referencias, son dos compras, y fusionarlas perdería dinero del saldo.
 * Las observaciones de `absorb` pasan a `keep`; `absorb` se borra. Es la
 * inversa exacta de `splitObservation`.
 */
export async function mergeTransactions(
  deps: IngestDeps,
  input: { owner: OwnerId; keep: TransactionId; absorb: TransactionId },
): Promise<void> {
  const [keep, absorb] = await Promise.all([
    deps.transactions.findById(input.keep),
    deps.transactions.findById(input.absorb),
  ]);
  if (keep === null || keep.owner !== input.owner) {
    throw new Error(`No existe la transacción "${input.keep}"`);
  }
  if (absorb === null || absorb.owner !== input.owner) {
    throw new Error(`No existe la transacción "${input.absorb}"`);
  }

  const monto = montoSinClasificar(keep);
  if (monto === null || monto !== montoSinClasificar(absorb)) {
    throw new Error('Solo se pueden fusionar transacciones del mismo monto y dirección');
  }

  const [deKeep, deAbsorb] = await Promise.all([
    deps.ingest.listObservations(input.keep),
    deps.ingest.listObservations(input.absorb),
  ]);
  const fuentesDeKeep = new Set(deKeep.map((o) => o.fuente));
  const repetida = deAbsorb.find((o) => fuentesDeKeep.has(o.fuente));
  if (repetida !== undefined) {
    throw new Error(
      `La misma fuente (${repetida.fuente}) vio las dos por separado: son dos transacciones`,
    );
  }

  for (const o of deAbsorb) {
    await deps.ingest.deleteObservation(o.id);
    await deps.ingest.saveObservation({
      ...o,
      id: observationId(input.keep, o.fuente, o.canal),
      transactionId: input.keep,
    });
  }
  await deps.transactions.delete(input.absorb);
}
