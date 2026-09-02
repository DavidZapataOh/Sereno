import { and, asc, desc, eq, gte, lt, lte } from 'drizzle-orm';

import {
  balanceCheckpoint,
  limiteDe,
  mesDespuesDe,
  mesUtilizableHasta,
  type BalanceCheckpoint,
} from '@/domain/ledger/balance-checkpoint';
import { accountId as comoCuenta } from '@/domain/ledger/ids';
import type { CheckpointRepository } from '@/domain/ledger/checkpoint-repository';

import { add, zero, type Money } from '@/domain/money/money';

import type { Database } from './database';
import { toMoney } from './mappers';
import { accounts, balanceCheckpoints, postings, transactions } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Los cortes de saldo, en SQLite.
 *
 * **Nada de lo que hay aquí es una fuente de verdad** (ADR 0006): todo se
 * puede reconstruir desde los apuntes, y `borrarTodo` seguido de cualquier
 * consulta tiene que dar las mismas cifras.
 */
export function createDrizzleCheckpointRepository(db: Database): CheckpointRepository {
  return {
    ultimoAntesDe: (id, hasta) =>
      asPromise(() => {
        const [fila] = db
          .select()
          .from(balanceCheckpoints)
          .where(
            hasta === undefined
              ? eq(balanceCheckpoints.accountId, id)
              : and(
                  eq(balanceCheckpoints.accountId, id),
                  // Solo sirve el corte cuya frontera no pase de `hasta`: uno
                  // posterior incluiría apuntes que no se han pedido.
                  lte(balanceCheckpoints.mes, mesUtilizableHasta(hasta)),
                ),
          )
          .orderBy(desc(balanceCheckpoints.mes))
          .limit(1)
          .all();

        if (fila === undefined) return null;
        return balanceCheckpoint({
          accountId: comoCuenta(fila.accountId),
          mes: fila.mes,
          saldo: toMoney(fila.amount, fila.currency),
          calculadoEn: fila.calculadoEn,
        });
      }),

    guardar: (cortes) =>
      asPromise(() => {
        guardarCortes(db, cortes);
      }),

    borrarDesde: (id, mes) =>
      asPromise(() => {
        db.delete(balanceCheckpoints)
          .where(and(eq(balanceCheckpoints.accountId, id), gte(balanceCheckpoints.mes, mes)))
          .run();
      }),

    listar: (id) =>
      asPromise(() =>
        db
          .select()
          .from(balanceCheckpoints)
          .where(eq(balanceCheckpoints.accountId, id))
          .orderBy(asc(balanceCheckpoints.mes))
          .all()
          .map((fila) =>
            balanceCheckpoint({
              accountId: comoCuenta(fila.accountId),
              mes: fila.mes,
              saldo: toMoney(fila.amount, fila.currency),
              calculadoEn: fila.calculadoEn,
            }),
          ),
      ),

    reconstruir: (hastaMes, calculadoEn) =>
      asPromise(() => {
        const limiteGlobal = limiteDe(hastaMes);
        let escritos = 0;

        for (const cuenta of db.select().from(accounts).all()) {
          const id = comoCuenta(cuenta.id);
          const [ultimo] = db
            .select()
            .from(balanceCheckpoints)
            .where(eq(balanceCheckpoints.accountId, cuenta.id))
            .orderBy(desc(balanceCheckpoints.mes))
            .limit(1)
            .all();

          if (ultimo !== undefined && ultimo.mes >= hastaMes) continue;

          const desde = ultimo === undefined ? undefined : limiteDe(ultimo.mes);
          const condiciones = [
            eq(postings.accountId, cuenta.id),
            lt(transactions.fecha, limiteGlobal),
          ];
          if (desde !== undefined) condiciones.push(gte(transactions.fecha, desde));

          const filas = db
            .select({
              amount: postings.amount,
              currency: postings.currency,
              fecha: transactions.fecha,
            })
            .from(postings)
            .innerJoin(transactions, eq(postings.transactionId, transactions.id))
            .where(and(...condiciones))
            .orderBy(asc(transactions.fecha))
            .all();

          if (filas.length === 0 && ultimo === undefined) continue;

          let acumulado: Money =
            ultimo === undefined
              ? zero(cuenta.currency as Money['currency'])
              : toMoney(ultimo.amount, ultimo.currency);
          // El primer mes que falta por cerrar. Se avanza comparando contra la
          // **misma frontera de texto** que usa `balanceOf`: agrupar por el
          // «AAAA-MM» de la fecha no es equivalente cuando una fecha llega con
          // otro huso, y un apunte que cayera en los dos lados se contaría dos
          // veces sin que nada fallara.
          let mes =
            ultimo === undefined
              ? mesInicial(filas[0]?.fecha ?? limiteGlobal)
              : mesDespuesDe(ultimo.mes);
          const nuevos: BalanceCheckpoint[] = [];

          for (const fila of filas) {
            while (fila.fecha >= limiteDe(mes)) {
              nuevos.push(balanceCheckpoint({ accountId: id, mes, saldo: acumulado, calculadoEn }));
              mes = mesDespuesDe(mes);
            }
            acumulado = add(acumulado, toMoney(fila.amount, fila.currency));
          }

          // Los meses sin movimiento también se cierran: así `balanceOf`
          // siempre encuentra un corte cerca y nunca vuelve a leer años de
          // apuntes por un mes tranquilo.
          while (mes <= hastaMes) {
            nuevos.push(balanceCheckpoint({ accountId: id, mes, saldo: acumulado, calculadoEn }));
            mes = mesDespuesDe(mes);
          }

          guardarCortes(db, nuevos);
          escritos += nuevos.length;
        }

        return escritos;
      }),

    borrarTodo: () =>
      asPromise(() => {
        db.delete(balanceCheckpoints).run();
      }),
  };
}

function guardarCortes(db: Database, cortes: readonly BalanceCheckpoint[]): void {
  if (cortes.length === 0) return;
  db.transaction((tx) => {
    for (const corte of cortes) {
      tx.delete(balanceCheckpoints)
        .where(
          and(
            eq(balanceCheckpoints.accountId, corte.accountId),
            eq(balanceCheckpoints.mes, corte.mes),
          ),
        )
        .run();
      tx.insert(balanceCheckpoints)
        .values({
          accountId: corte.accountId,
          mes: corte.mes,
          amount: corte.saldo.amount.toString(),
          currency: corte.saldo.currency,
          calculadoEn: corte.calculadoEn,
        })
        .run();
    }
  });
}

/** El mes al que pertenece el primer apunte, según la frontera de texto. */
function mesInicial(fecha: string): string {
  let mes = fecha.slice(0, 7);
  while (fecha >= limiteDe(mes)) mes = mesDespuesDe(mes);
  return mes;
}
