import { array, assert, asyncProperty, integer, record } from 'fast-check';

import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleCheckpointRepository } from './drizzle-checkpoint-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { createTestDb, type TestDb } from './test-client';

const owner = ownerId('david');
const banco = accountId('banco');
const gasto = accountId('categoria:mercado');
const HASTA_MES = '2026-08';
const AHORA = '2026-09-01T10:00:00.000-05:00';

async function montar(): Promise<{
  cliente: TestDb;
  cuentas: ReturnType<typeof createDrizzleAccountRepository>;
  transacciones: ReturnType<typeof createDrizzleTransactionRepository>;
  cortes: ReturnType<typeof createDrizzleCheckpointRepository>;
}> {
  const cliente = createTestDb();
  const cuentas = createDrizzleAccountRepository(cliente.db);
  const transacciones = createDrizzleTransactionRepository(cliente.db);
  const cortes = createDrizzleCheckpointRepository(cliente.db);

  await cuentas.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Banco', currency: 'COP' }),
  );
  await cuentas.save(
    createAccount({ id: gasto, owner, kind: 'gasto', nombre: 'Mercado', currency: 'COP' }),
  );
  return { cliente, cuentas, transacciones, cortes };
}

const gastar = (
  transacciones: ReturnType<typeof createDrizzleTransactionRepository>,
  id: string,
  monto: number,
  fecha: string,
) =>
  transacciones.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'Compra',
      origen: { fuente: 'siembra', referencia: id },
      postings: [
        { accountId: banco, amount: money(-monto, 'COP') },
        { accountId: gasto, amount: money(monto, 'COP') },
      ],
    }),
  );

describe('cortes de saldo', () => {
  jest.setTimeout(60_000);

  /**
   * La propiedad que sostiene el plan entero: el corte es un caché, y un caché
   * que cambia una cifra no es un caché, es un error con otro nombre.
   */
  it('el saldo con cortes es idéntico al derivado desde cero', async () => {
    await assert(
      asyncProperty(
        array(
          record({
            monto: integer({ min: 1, max: 500_000 }),
            mes: integer({ min: 1, max: 12 }),
            dia: integer({ min: 1, max: 28 }),
            anio: integer({ min: 2024, max: 2026 }),
          }),
          { minLength: 1, maxLength: 25 },
        ),
        async (movimientos) => {
          const { cliente, cuentas, cortes } = await montar();
          const transacciones = createDrizzleTransactionRepository(cliente.db);
          try {
            let n = 0;
            for (const m of movimientos) {
              n += 1;
              const fecha = `${String(m.anio)}-${String(m.mes).padStart(2, '0')}-${String(m.dia).padStart(2, '0')}T10:00:00.000-05:00`;
              await gastar(transacciones, `t${String(n)}`, m.monto, fecha);
            }

            const sinCortes = await cuentas.balanceOf(banco);
            await cortes.reconstruir(HASTA_MES, AHORA);
            const conCortes = await cuentas.balanceOf(banco);

            expect(conCortes.amount).toBe(sinCortes.amount);
          } finally {
            cliente.close();
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('el saldo hasta una fecha también coincide, con y sin cortes', async () => {
    const { cliente, cuentas, transacciones, cortes } = await montar();
    try {
      await gastar(transacciones, 't1', 1000, '2026-01-15T10:00:00.000-05:00');
      await gastar(transacciones, 't2', 2000, '2026-05-20T10:00:00.000-05:00');
      await gastar(transacciones, 't3', 4000, '2026-08-10T10:00:00.000-05:00');
      await gastar(transacciones, 't4', 8000, '2026-09-02T10:00:00.000-05:00');

      const cortesDePrueba = [
        '2026-01-31T23:59:59.999-05:00',
        '2026-05-20T10:00:00.000-05:00',
        '2026-06-01T00:00:00.000-05:00',
        '2026-08-31T23:59:59.999-05:00',
        '2026-09-30T23:59:59.999-05:00',
      ];
      const sin = [];
      for (const hasta of cortesDePrueba)
        sin.push((await cuentas.balanceOf(banco, { hasta })).amount);

      await cortes.reconstruir(HASTA_MES, AHORA);

      for (const [i, hasta] of cortesDePrueba.entries()) {
        expect((await cuentas.balanceOf(banco, { hasta })).amount).toBe(sin[i]);
      }
    } finally {
      cliente.close();
    }
  });

  /** Si la app depende del caché para acertar, no es un caché. */
  it('borrar todos los cortes no cambia ninguna cifra', async () => {
    const { cliente, cuentas, transacciones, cortes } = await montar();
    try {
      await gastar(transacciones, 't1', 1000, '2026-03-10T10:00:00.000-05:00');
      await gastar(transacciones, 't2', 2000, '2026-07-10T10:00:00.000-05:00');
      await cortes.reconstruir(HASTA_MES, AHORA);

      const conCortes = await cuentas.balanceOf(banco);
      await cortes.borrarTodo();

      expect((await cuentas.balanceOf(banco)).amount).toBe(conCortes.amount);
    } finally {
      cliente.close();
    }
  });

  /** La ingesta trae correo con retraso: esto no es un caso raro. */
  it('un movimiento con fecha vieja invalida los cortes posteriores', async () => {
    const { cliente, cuentas, transacciones, cortes } = await montar();
    try {
      await gastar(transacciones, 't1', 1000, '2026-07-10T10:00:00.000-05:00');
      await cortes.reconstruir(HASTA_MES, AHORA);

      // Llega un movimiento de marzo, tres meses tarde.
      await gastar(transacciones, 'tardio', 5000, '2026-03-01T10:00:00.000-05:00');

      expect((await cuentas.balanceOf(banco)).amount).toBe(-6000n);
      // Y los cortes de marzo en adelante ya no están: se borran, no se ajustan.
      expect((await cortes.listar(banco)).every((c) => c.mes < '2026-03')).toBe(true);
    } finally {
      cliente.close();
    }
  });

  it('mover una transacción de cuenta invalida las dos', async () => {
    const { cliente, cuentas, transacciones, cortes } = await montar();
    const otra = accountId('otra');
    try {
      await cuentas.save(
        createAccount({ id: otra, owner, kind: 'activo', nombre: 'Otra', currency: 'COP' }),
      );
      await gastar(transacciones, 't1', 1000, '2026-04-10T10:00:00.000-05:00');
      await cortes.reconstruir(HASTA_MES, AHORA);

      // La misma transacción, ahora contra la otra cuenta.
      await transacciones.save(
        createTransaction({
          id: transactionId('t1'),
          owner,
          fecha: '2026-04-10T10:00:00.000-05:00',
          descripcion: 'Compra',
          origen: { fuente: 'siembra', referencia: 't1' },
          postings: [
            { accountId: otra, amount: money(-1000, 'COP') },
            { accountId: gasto, amount: money(1000, 'COP') },
          ],
        }),
      );

      expect((await cuentas.balanceOf(banco)).amount).toBe(0n);
      expect((await cuentas.balanceOf(otra)).amount).toBe(-1000n);
    } finally {
      cliente.close();
    }
  });

  it('borrar una transacción invalida los cortes de sus cuentas', async () => {
    const { cliente, cuentas, transacciones, cortes } = await montar();
    try {
      await gastar(transacciones, 't1', 1000, '2026-04-10T10:00:00.000-05:00');
      await gastar(transacciones, 't2', 3000, '2026-05-10T10:00:00.000-05:00');
      await cortes.reconstruir(HASTA_MES, AHORA);

      await transacciones.delete(transactionId('t1'));

      expect((await cuentas.balanceOf(banco)).amount).toBe(-3000n);
    } finally {
      cliente.close();
    }
  });

  it('reconstruir dos veces no duplica nada', async () => {
    const { cliente, cuentas, transacciones, cortes } = await montar();
    try {
      await gastar(transacciones, 't1', 1000, '2026-04-10T10:00:00.000-05:00');
      await cortes.reconstruir(HASTA_MES, AHORA);
      const primera = await cuentas.balanceOf(banco);

      const escritos = await cortes.reconstruir(HASTA_MES, AHORA);

      expect(escritos).toBe(0);
      expect((await cuentas.balanceOf(banco)).amount).toBe(primera.amount);
    } finally {
      cliente.close();
    }
  });

  /** Un mes a medias no es un corte: es una foto que envejece mal. */
  it('no escribe cortes del mes en curso', async () => {
    const { cliente, transacciones, cortes } = await montar();
    try {
      await gastar(transacciones, 't1', 1000, '2026-09-10T10:00:00.000-05:00');
      await cortes.reconstruir(HASTA_MES, AHORA);

      expect((await cortes.listar(banco)).every((c) => c.mes <= HASTA_MES)).toBe(true);
    } finally {
      cliente.close();
    }
  });
});
