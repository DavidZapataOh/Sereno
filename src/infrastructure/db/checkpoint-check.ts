import { and, eq, lt } from 'drizzle-orm';

import { finDeMes } from '@/domain/time/month';
import { sum, type Money } from '@/domain/money/money';

import type { Database } from './database';
import { toMoney } from './mappers';
import { accounts, balanceCheckpoints, postings, transactions } from './schema';

export interface DiferenciaDeCorte {
  accountId: string;
  mes: string;
  guardado: bigint;
  derivado: bigint;
}

export interface ReporteDeCortes {
  revisados: number;
  diferencias: DiferenciaDeCorte[];
  sano: boolean;
}

/**
 * Comprueba que ningún corte de saldo mienta, **sobre datos reales**.
 *
 * La suite comprueba la propiedad con datos inventados; esto la comprueba con
 * el historial de verdad, que es donde aparecen los casos que nadie imaginó:
 * un movimiento con la fecha en otro huso, una cuenta archivada, una
 * transacción reemplazada dos veces el mismo día.
 *
 * Una diferencia aquí no es un aviso de estilo: significa que la app enseña un
 * saldo equivocado y no lo sabe.
 */
export function checkCheckpoints(db: Database): ReporteDeCortes {
  const monedaDe = new Map(
    db
      .select({ id: accounts.id, currency: accounts.currency })
      .from(accounts)
      .all()
      .map((fila) => [fila.id, fila.currency]),
  );

  const cortes = db.select().from(balanceCheckpoints).all();
  const diferencias: DiferenciaDeCorte[] = [];

  for (const corte of cortes) {
    const moneda = (monedaDe.get(corte.accountId) ?? corte.currency) as Money['currency'];

    // Exactamente el conjunto que el corte dice resumir: todo lo anterior a su
    // frontera, comparada como texto igual que hace `balanceOf`.
    const derivado = sum(
      db
        .select({ amount: postings.amount, currency: postings.currency })
        .from(postings)
        .innerJoin(transactions, eq(postings.transactionId, transactions.id))
        .where(
          and(eq(postings.accountId, corte.accountId), lt(transactions.fecha, finDeMes(corte.mes))),
        )
        .all()
        .map((fila) => toMoney(fila.amount, fila.currency)),
      moneda,
    );

    const guardado = toMoney(corte.amount, corte.currency);
    if (guardado.amount !== derivado.amount) {
      diferencias.push({
        accountId: corte.accountId,
        mes: corte.mes,
        guardado: guardado.amount,
        derivado: derivado.amount,
      });
    }
  }

  return { revisados: cortes.length, diferencias, sano: diferencias.length === 0 };
}
