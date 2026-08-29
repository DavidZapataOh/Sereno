import { sql } from 'drizzle-orm';

import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { createTestDb } from './test-client';

/**
 * Que las consultas usen los índices, comprobado por plan de ejecución.
 *
 * La prueba de rendimiento por reloj no sirve para esto: medido con cinco mil
 * filas, quitar los dos índices de `transactions` cambia la deduplicación de
 * 1 ms a 4 ms y no cambia la paginación en absoluto. Es decir, esa prueba
 * pasaría igual sin ningún índice. SQLite es demasiado rápido a este volumen
 * para que el reloj distinga, y el volumen al que sí distinguiría —cientos de
 * miles de filas— haría la prueba inservible por lenta.
 *
 * `EXPLAIN QUERY PLAN` lo responde exacto: dice `SEARCH ... USING INDEX` cuando
 * el índice se usa y `SCAN` cuando la consulta recorre la tabla entera.
 *
 * Las sentencias se capturan de la ejecución real del repositorio, no se
 * reescriben aquí: una copia escrita a mano se desincroniza de la consulta de
 * verdad sin que nadie lo note.
 */
describe('uso de índices', () => {
  const capturarSql = async (
    ejercicio: (repos: {
      transacciones: ReturnType<typeof createDrizzleTransactionRepository>;
      cuentas: ReturnType<typeof createDrizzleAccountRepository>;
    }) => Promise<void>,
  ): Promise<{ sentencias: string[]; explicar: (consulta: string) => string }> => {
    const capturadas: string[] = [];
    const cliente = createTestDb({
      onSql: (sentencia) => {
        capturadas.push(sentencia);
      },
    });

    const cuentas = createDrizzleAccountRepository(cliente.db);
    const transacciones = createDrizzleTransactionRepository(cliente.db);

    await cuentas.save(
      createAccount({
        id: accountId('banco'),
        owner: ownerId('david'),
        kind: 'activo',
        nombre: 'Banco',
        currency: 'COP',
      }),
    );
    await cuentas.save(
      createAccount({
        id: accountId('gasto'),
        owner: ownerId('david'),
        kind: 'gasto',
        nombre: 'Gasto',
        currency: 'COP',
      }),
    );
    await transacciones.save(
      createTransaction({
        id: transactionId('t1'),
        owner: ownerId('david'),
        fecha: '2026-08-20T10:00:00.000Z',
        descripcion: 'Compra',
        origen: { fuente: 'bancolombia', referencia: 'REF-1' },
        postings: [
          { accountId: accountId('banco'), amount: money(-1000, 'COP') },
          { accountId: accountId('gasto'), amount: money(1000, 'COP') },
        ],
      }),
    );

    capturadas.length = 0;
    await ejercicio({ transacciones, cuentas });

    const explicar = (consulta: string): string =>
      cliente.db
        .all<{ detail: string }>(sql.raw(`EXPLAIN QUERY PLAN ${consulta}`))
        .map((fila) => fila.detail)
        .join(' | ');

    return { sentencias: [...capturadas], explicar };
  };

  const selectSobre = (sentencias: string[], tabla: string): string => {
    const encontrada = sentencias.find(
      (s) => s.startsWith('select') && s.includes(`from "${tabla}"`),
    );
    if (encontrada === undefined) {
      throw new Error(`Ninguna consulta capturada lee de "${tabla}": ${sentencias.join(' ;; ')}`);
    }
    return encontrada;
  };

  it('la deduplicación busca por índice, no recorre la tabla', async () => {
    const { sentencias, explicar } = await capturarSql(async ({ transacciones }) => {
      await transacciones.existsByOrigin(ownerId('david'), 'bancolombia', 'REF-1');
    });

    const plan = explicar(selectSobre(sentencias, 'transactions'));

    expect(plan).toContain('idx_transactions_origen');
    expect(plan).not.toContain('SCAN transactions');
  });

  it('el listado paginado se sirve por índice, sin ordenar en memoria', async () => {
    const { sentencias, explicar } = await capturarSql(async ({ transacciones }) => {
      await transacciones.list(ownerId('david'), undefined, { limit: 50 });
    });

    const plan = explicar(selectSobre(sentencias, 'transactions'));

    expect(plan).toContain('idx_transactions_owner_fecha');
    expect(plan).not.toContain('SCAN transactions');
    // Un `USE TEMP B-TREE FOR ORDER BY` significa que SQLite trae las filas y
    // las ordena aparte: con años de historial, eso es traerlo todo a memoria
    // para devolver cincuenta.
    expect(plan).not.toContain('TEMP B-TREE');
  });

  it('el saldo busca los apuntes de la cuenta por índice', async () => {
    const { sentencias, explicar } = await capturarSql(async ({ cuentas }) => {
      await cuentas.balanceOf(accountId('banco'));
    });

    const plan = explicar(selectSobre(sentencias, 'postings'));

    expect(plan).toContain('idx_postings_account');
    expect(plan).not.toContain('SCAN postings');
  });

  it('listar las cuentas de un propietario usa su índice', async () => {
    const { sentencias, explicar } = await capturarSql(async ({ cuentas }) => {
      await cuentas.listByOwner(ownerId('david'));
    });

    const plan = explicar(selectSobre(sentencias, 'accounts'));

    expect(plan).toContain('idx_accounts_owner');
  });
});
