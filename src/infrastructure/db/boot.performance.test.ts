import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'node:path';

import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

import type { Database } from './database';
import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleCheckpointRepository } from './drizzle-checkpoint-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import * as schema from './schema';

const owner = ownerId('david');
const CARPETA = join(__dirname, '../../../drizzle');

/**
 * Cinco años a ochenta movimientos al mes.
 *
 * Ochenta y no doce: la ingesta de David trajo setenta y ocho movimientos en la
 * primera corrida del sprint 06. Medir con doce daría un número bonito y
 * mentiroso.
 */
const MESES = 60;
const POR_MES = 80;
const CUENTAS = 19;

/**
 * Los presupuestos del arranque.
 *
 * **Las cifras se midieron primero y el tope se puso por encima.** Un
 * presupuesto inventado hace una de dos cosas: falla desde el primer día y se
 * termina subiendo hasta que no significa nada, o es tan holgado que nunca dice
 * nada.
 *
 * Los topes son generosos —entre cuatro y diez veces lo medido— porque esta
 * suite corre en paralelo con otras noventa y el reloj mide la máquina. Sirven
 * para detectar que algo se volvió un orden de magnitud más lento, que es lo
 * que de verdad se nota al abrir la app.
 *
 * **Y no miden el teléfono de David.** Eso lo dice la tarjeta de diagnóstico,
 * que es otra cosa y se lee aparte.
 */
const PRESUPUESTO = {
  /** Medido: 15 ms. Todas las migraciones desde cero, solo al instalar. */
  migracionesDesdeCero: 500,
  /** Medido: 2 ms. Lo que pasa cada mañana: abrir una base ya migrada. */
  migracionesAlDia: 100,
  /** Medido: 501 ms con 4 800 movimientos. La primera vez, en segundo plano. */
  cortesDesdeCero: 2500,
  /** Medido: 9 ms. Lo que pasa cada mañana: los cortes ya están al día. */
  cortesAlDia: 200,
};

function medir(operacion: () => unknown): number {
  const inicio = Date.now();
  operacion();
  return Date.now() - inicio;
}

async function medirAsync(operacion: () => Promise<unknown>): Promise<number> {
  const inicio = Date.now();
  await operacion();
  return Date.now() - inicio;
}

describe('presupuesto de arranque', () => {
  jest.setTimeout(180_000);

  let sqlite: SQLite.Database;
  // Dos vistas de la misma base: `migrate` exige el tipo del driver, y los
  // repositorios hablan del `Database` del proyecto.
  let driver: ReturnType<typeof drizzle<typeof schema>>;
  let db: Database;

  const abrir = (): void => {
    sqlite = new SQLite(':memory:');
    sqlite.pragma('foreign_keys = ON');
    driver = drizzle(sqlite, { schema });
    db = driver;
  };

  afterEach(() => {
    sqlite.close();
  });

  it('aplicar todas las migraciones desde cero cabe en el presupuesto', () => {
    abrir();

    const ms = medir(() => {
      migrate(driver, { migrationsFolder: CARPETA });
    });

    expect(ms).toBeLessThan(PRESUPUESTO.migracionesDesdeCero);
  });

  /** El caso de todas las mañanas: la base ya está al día y no hay nada que aplicar. */
  it('arrancar sobre una base ya migrada casi no cuesta', () => {
    abrir();
    migrate(driver, { migrationsFolder: CARPETA });

    const ms = medir(() => {
      migrate(driver, { migrationsFolder: CARPETA });
    });

    expect(ms).toBeLessThan(PRESUPUESTO.migracionesAlDia);
  });

  describe('con cinco años de historial', () => {
    const sembrar = async (): Promise<void> => {
      const cuentas = createDrizzleAccountRepository(db);
      const transacciones = createDrizzleTransactionRepository(db);

      for (let c = 0; c < CUENTAS; c += 1) {
        await cuentas.save(
          createAccount({
            id: accountId(`banco:${String(c)}`),
            owner,
            kind: 'activo',
            nombre: `Cuenta ${String(c)}`,
            currency: 'COP',
          }),
        );
      }
      await cuentas.save(
        createAccount({
          id: accountId('categoria:mercado'),
          owner,
          kind: 'gasto',
          nombre: 'Mercado',
          currency: 'COP',
        }),
      );

      let n = 0;
      for (let mes = 0; mes < MESES; mes += 1) {
        for (let i = 0; i < POR_MES; i += 1) {
          n += 1;
          const fecha = `${String(2021 + Math.floor(mes / 12))}-${String((mes % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000-05:00`;
          await transacciones.save(
            createTransaction({
              id: transactionId(`t${String(n).padStart(6, '0')}`),
              owner,
              fecha,
              descripcion: 'Compra',
              origen: { fuente: 'siembra', referencia: `ref-${String(n)}` },
              postings: [
                {
                  accountId: accountId(`banco:${String((mes + i) % CUENTAS)}`),
                  amount: money(-1000, 'COP'),
                },
                { accountId: accountId('categoria:mercado'), amount: money(1000, 'COP') },
              ],
            }),
          );
        }
      }
    };

    it('calcular los cortes por primera vez cabe en el presupuesto', async () => {
      abrir();
      migrate(driver, { migrationsFolder: CARPETA });
      await sembrar();
      const cortes = createDrizzleCheckpointRepository(db);

      const ms = await medirAsync(() =>
        cortes.reconstruir('2026-08', '2026-09-01T10:00:00.000-05:00'),
      );

      expect(ms).toBeLessThan(PRESUPUESTO.cortesDesdeCero);
    });

    /**
     * El caso de todas las mañanas. Es el que importa: la primera vez ocurre
     * una sola vez en la vida de la instalación, y va en segundo plano.
     */
    it('cuando los cortes ya están al día, arrancar no cuesta nada', async () => {
      abrir();
      migrate(driver, { migrationsFolder: CARPETA });
      await sembrar();
      const cortes = createDrizzleCheckpointRepository(db);
      await cortes.reconstruir('2026-08', '2026-09-01T10:00:00.000-05:00');

      const ms = await medirAsync(() =>
        cortes.reconstruir('2026-08', '2026-09-01T10:00:00.000-05:00'),
      );

      expect(ms).toBeLessThan(PRESUPUESTO.cortesAlDia);
    });
  });
});
