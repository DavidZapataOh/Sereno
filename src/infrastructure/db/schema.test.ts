import { sql } from 'drizzle-orm';

import { accounts, postings, transactions } from './schema';
import { createTestDb } from './test-client';

type TestDb = ReturnType<typeof createTestDb>;

describe('esquema y migraciones', () => {
  let cliente: TestDb;

  beforeEach(() => {
    cliente = createTestDb();
  });

  afterEach(() => {
    cliente.close();
  });

  const insertarCuenta = (id: string): void => {
    cliente.db
      .insert(accounts)
      .values({
        id,
        ownerId: 'duenio-1',
        kind: 'activo',
        nombre: 'Ahorros Bancolombia',
        currency: 'COP',
      })
      .run();
  };

  const insertarTransaccion = (id: string): void => {
    cliente.db
      .insert(transactions)
      .values({
        id,
        ownerId: 'duenio-1',
        fecha: '2026-08-29T10:00:00.000-05:00',
        descripcion: 'Compra',
        fuente: 'bancolombia',
      })
      .run();
  };

  it('aplica las migraciones y crea las cinco tablas', () => {
    const tablas = cliente.db
      .all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .map((fila) => fila.name)
      .filter((nombre) => !nombre.startsWith('__drizzle'));

    expect(tablas).toEqual([
      'accounts',
      'ingest_runs',
      'postings',
      'transaction_observations',
      'transactions',
    ]);
  });

  it('crea los nueve índices declarados', () => {
    const indices = cliente.db
      .all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name`,
      )
      .map((fila) => fila.name);

    expect(indices).toEqual([
      'idx_accounts_owner',
      'idx_ingest_runs_owner_fuente',
      'idx_observations_huella',
      'idx_observations_origen',
      'idx_observations_transaction',
      'idx_postings_account',
      'idx_postings_transaction',
      'idx_transactions_origen',
      'idx_transactions_owner_fecha',
    ]);
  });

  it('deja las claves foráneas activadas', () => {
    const [fila] = cliente.db.all<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);

    expect(fila?.foreign_keys).toBe(1);
  });

  it('rechaza un apunte cuya transacción no existe', () => {
    insertarCuenta('cuenta-1');

    expect(() => {
      cliente.db
        .insert(postings)
        .values({
          id: 'apunte-1',
          transactionId: 'transaccion-fantasma',
          accountId: 'cuenta-1',
          amount: '1000',
          currency: 'COP',
        })
        .run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('rechaza un apunte cuya cuenta no existe', () => {
    insertarTransaccion('transaccion-1');

    expect(() => {
      cliente.db
        .insert(postings)
        .values({
          id: 'apunte-1',
          transactionId: 'transaccion-1',
          accountId: 'cuenta-fantasma',
          amount: '1000',
          currency: 'COP',
        })
        .run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('borra los apuntes en cascada al borrar la transacción', () => {
    insertarCuenta('cuenta-1');
    insertarTransaccion('transaccion-1');
    cliente.db
      .insert(postings)
      .values({
        id: 'apunte-1',
        transactionId: 'transaccion-1',
        accountId: 'cuenta-1',
        amount: '1000',
        currency: 'COP',
      })
      .run();

    cliente.db.delete(transactions).run();

    expect(cliente.db.select().from(postings).all()).toEqual([]);
  });

  it('impide borrar una cuenta que todavía tiene apuntes', () => {
    insertarCuenta('cuenta-1');
    insertarTransaccion('transaccion-1');
    cliente.db
      .insert(postings)
      .values({
        id: 'apunte-1',
        transactionId: 'transaccion-1',
        accountId: 'cuenta-1',
        amount: '1000',
        currency: 'COP',
      })
      .run();

    expect(() => {
      cliente.db.delete(accounts).run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('guarda un importe de escala wei sin perder un solo dígito', () => {
    // La razón por la que `amount` es TEXT y no INTEGER: 3 ether son
    // 3×10^18 unidades mínimas y el entero de 64 bits de SQLite llega a
    // ~9,22×10^18. Guardado como número, el redondeo a coma flotante de
    // JavaScript se lo comería mucho antes.
    const wei = (3n * 10n ** 18n + 7n).toString();
    insertarCuenta('cuenta-1');
    insertarTransaccion('transaccion-1');
    cliente.db
      .insert(postings)
      .values({
        id: 'apunte-1',
        transactionId: 'transaccion-1',
        accountId: 'cuenta-1',
        amount: wei,
        currency: 'ETH',
      })
      .run();

    const [leido] = cliente.db.select().from(postings).all();

    expect(leido?.amount).toBe('3000000000000000007');
    expect(BigInt(leido?.amount ?? '0')).toBe(3n * 10n ** 18n + 7n);
  });

  it('cada base en memoria está aislada de las demás', () => {
    insertarCuenta('cuenta-1');
    const otro = createTestDb();

    try {
      expect(otro.db.select().from(accounts).all()).toEqual([]);
    } finally {
      otro.close();
    }
  });
});
