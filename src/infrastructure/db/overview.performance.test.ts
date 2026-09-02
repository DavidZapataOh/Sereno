import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { getOverview } from '@/application/overview/get-overview';
import { ensureSystemAccounts } from '@/application/ledger/ensure-system-accounts';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryRateRepository } from '@/test/fakes/in-memory-rate-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleCheckpointRepository } from './drizzle-checkpoint-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { createTestDb, type TestDb } from './test-client';

const owner = ownerId('david');

/** Las cuentas que David tiene de verdad: dos bancos, tres tarjetas, catorce cadenas. */
const CUENTAS = 19;
/** Movimientos al mes. Doce al mes por cuenta es un uso normal. */
const POR_MES = 12;

/**
 * Cuánto cuesta **abrir una pantalla**, medido en filas leídas.
 *
 * `performance.test.ts` mide consultas sueltas contra el reloj y avisa de que
 * algo se volvió diez veces más lento. No avisa de esto: que la pantalla de
 * inicio recorra el historial entero **una vez por cuenta**. Con poco volumen
 * no se nota en el reloj, y con cinco años es la diferencia entre abrir la app
 * y esperarla.
 *
 * Se cuentan filas y no milisegundos a propósito: el reloj mide la máquina
 * donde corre la suite —y falla solo cuando la suite va cargada—; las filas
 * miden el diseño, y dan el mismo número en cualquier máquina.
 */
describe('lo que cuesta abrir la pantalla de inicio', () => {
  jest.setTimeout(120_000);

  const sembrar = async (meses: number): Promise<{ cliente: TestDb; filas: () => number }> => {
    let leidas = 0;
    const cliente = createTestDb({
      onFilas: (_sql, filas) => {
        leidas += filas;
      },
    });
    const cuentas = createDrizzleAccountRepository(cliente.db);
    const transacciones = createDrizzleTransactionRepository(cliente.db);
    await ensureSystemAccounts(cuentas, owner);

    for (let c = 0; c < CUENTAS; c += 1) {
      await cuentas.save(
        createAccount({
          id: accountId(`banco:${String(c)}`),
          owner,
          kind: c % 4 === 0 ? 'pasivo' : 'activo',
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
    for (let mes = 0; mes < meses; mes += 1) {
      for (let i = 0; i < POR_MES; i += 1) {
        const cuenta = accountId(`banco:${String((mes + i) % CUENTAS)}`);
        const dia = String((i % 28) + 1).padStart(2, '0');
        const fecha = `${String(2021 + Math.floor(mes / 12))}-${String((mes % 12) + 1).padStart(2, '0')}-${dia}T10:00:00.000-05:00`;
        n += 1;
        await transacciones.save(
          createTransaction({
            id: transactionId(`t${String(n).padStart(6, '0')}`),
            owner,
            fecha,
            descripcion: 'Compra',
            origen: { fuente: 'siembra', referencia: `ref-${String(n)}` },
            postings: [
              { accountId: cuenta, amount: money(-1000, 'COP') },
              { accountId: accountId('categoria:mercado'), amount: money(1000, 'COP') },
            ],
          }),
        );
      }
    }

    // Los cortes se ponen al día al arrancar la app, como en el teléfono: no
    // es parte de abrir la pantalla y por eso se hace antes de contar.
    await createDrizzleCheckpointRepository(cliente.db).reconstruir(
      '2026-08',
      '2026-09-01T10:00:00.000-05:00',
    );

    // Se cuenta solo lo que cuesta ABRIR la pantalla, no la siembra.
    const desde = leidas;
    return { cliente, filas: () => leidas - desde };
  };

  const abrir = async (meses: number): Promise<number> => {
    const { cliente, filas } = await sembrar(meses);
    try {
      await getOverview(
        {
          accounts: createDrizzleAccountRepository(cliente.db),
          ingest: createInMemoryIngestRepository(),
          reconciliations: createInMemoryReconciliationRepository(),
          rates: createInMemoryRateRepository(),
        },
        owner,
      );
      return filas();
    } finally {
      cliente.close();
    }
  };

  it('abrir la pantalla no cuesta cinco veces más por tener cinco años', async () => {
    const unAnio = await abrir(12);
    const cincoAnios = await abrir(60);

    // No se exige que sea igual —hay cuentas y tasas que leer siempre—, sino
    // que el historial deje de multiplicar. Sin cortes de saldo, esto es
    // exactamente cinco veces.
    expect(cincoAnios).toBeLessThan(unAnio * 2);
  });

  it('el coste de abrir la pantalla tiene un techo', async () => {
    // Un número absoluto además del relativo: sin él, empeorar las dos medidas
    // a la vez pasaría desapercibido.
    expect(await abrir(60)).toBeLessThan(150);
  });
});
