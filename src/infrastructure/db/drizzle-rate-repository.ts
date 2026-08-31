import { and, desc, eq, lte } from 'drizzle-orm';

import type { CurrencyCode } from '@/domain/money/currency';
import type { Rate } from '@/domain/rates/rate';
import type { RateRepository } from '@/domain/rates/rate-repository';

import type { Database } from './database';
import { rates } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

/** El valor vuelve a `bigint` desde el texto: nunca pasa por `number`. */
const toRate = (fila: typeof rates.$inferSelect): Rate => ({
  desde: fila.desde as CurrencyCode,
  hacia: fila.hacia as CurrencyCode,
  valor: BigInt(fila.valor),
  escala: fila.escala,
  origen: fila.origen,
  momento: fila.momento,
});

export function createDrizzleRateRepository(db: Database): RateRepository {
  const delPar = (desdeM: CurrencyCode, haciaM: CurrencyCode) =>
    and(eq(rates.desde, desdeM), eq(rates.hacia, haciaM));

  return {
    guardar: (tasa) =>
      asPromise(() => {
        const fila = {
          desde: tasa.desde,
          hacia: tasa.hacia,
          momento: tasa.momento,
          valor: tasa.valor.toString(),
          escala: tasa.escala,
          origen: tasa.origen,
        };
        // La misma tasa del mismo par y el mismo momento se guarda una vez:
        // sin esto, cada arranque de la app duplicaría la fila.
        db.insert(rates)
          .values(fila)
          .onConflictDoUpdate({
            target: [rates.desde, rates.hacia, rates.momento],
            set: { valor: fila.valor, escala: fila.escala, origen: fila.origen },
          })
          .run();
      }),

    ultima: (desdeM, haciaM) =>
      asPromise(() => {
        // Por momento, no por orden de inserción: se pueden guardar fuera de
        // orden al recuperar un histórico.
        const [fila] = db
          .select()
          .from(rates)
          .where(delPar(desdeM, haciaM))
          .orderBy(desc(rates.momento))
          .limit(1)
          .all();
        return fila === undefined ? null : toRate(fila);
      }),

    enFecha: (desdeM, haciaM, dia) =>
      asPromise(() => {
        // La que regía ese día: la más reciente que no sea posterior. Valorar
        // el pasado con la tasa de hoy lo reescribiría.
        const [fila] = db
          .select()
          .from(rates)
          .where(and(delPar(desdeM, haciaM), lte(rates.momento, `${dia}T23:59:59.999-05:00`)))
          .orderBy(desc(rates.momento))
          .limit(1)
          .all();
        return fila === undefined ? null : toRate(fila);
      }),

    vigentes: () =>
      asPromise(() => {
        const todas = db.select().from(rates).orderBy(desc(rates.momento)).all();
        const porPar = new Map<string, Rate>();
        for (const fila of todas) {
          const clave = `${fila.desde}->${fila.hacia}`;
          // Vienen ordenadas de más reciente a más vieja: la primera de cada
          // par es la vigente.
          if (!porPar.has(clave)) porPar.set(clave, toRate(fila));
        }
        return [...porPar.values()];
      }),
  };
}
