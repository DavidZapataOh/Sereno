import { sql } from 'drizzle-orm';

import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { mustExist } from '@/test/must-exist';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { checkLedger } from './ledger-check';
import { createTestDb } from './test-client';

const owner = ownerId('david');

describe('verificación del ledger sobre la base real', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let cuentas: ReturnType<typeof createDrizzleAccountRepository>;
  let transacciones: ReturnType<typeof createDrizzleTransactionRepository>;

  beforeEach(async () => {
    cliente = createTestDb();
    cuentas = createDrizzleAccountRepository(cliente.db);
    transacciones = createDrizzleTransactionRepository(cliente.db);

    await cuentas.save(
      createAccount({
        id: accountId('banco'),
        owner,
        kind: 'activo',
        nombre: 'Banco',
        currency: 'COP',
      }),
    );
    await cuentas.save(
      createAccount({
        id: accountId('gasto'),
        owner,
        kind: 'gasto',
        nombre: 'Gasto',
        currency: 'COP',
      }),
    );
  });

  afterEach(() => {
    cliente.close();
  });

  const guardar = (id: string, monto: number): Promise<void> =>
    transacciones.save(
      createTransaction({
        id: transactionId(id),
        owner,
        fecha: '2026-08-20T00:00:00.000Z',
        descripcion: 'Compra',
        origen: { fuente: 'prueba', referencia: `ref-${id}` },
        postings: [
          { accountId: accountId('banco'), amount: money(-monto, 'COP') },
          { accountId: accountId('gasto'), amount: money(monto, 'COP') },
        ],
      }),
    );

  const invariantesRotas = (): string[] =>
    checkLedger(cliente.db).violaciones.map((v) => v.invariante);

  it('una base vacía está sana', () => {
    const reporte = checkLedger(cliente.db);

    expect(reporte.sano).toBe(true);
    expect(reporte.violaciones).toEqual([]);
  });

  it('un ledger correcto está sano y dice cuánto revisó', async () => {
    await guardar('t1', 45000);
    await guardar('t2', 12000);

    const reporte = checkLedger(cliente.db);

    expect(reporte.sano).toBe(true);
    expect(reporte.revisado).toEqual({ cuentas: 2, transacciones: 2, apuntes: 4 });
  });

  it('detecta un apunte manipulado en la base', async () => {
    await guardar('t1', 45000);
    cliente.db.run(sql`UPDATE postings SET amount = '1' WHERE transaction_id = 't1'`);

    expect(invariantesRotas()).toContain('transaccion-cuadrada');
  });

  it('detecta un apunte insertado sin pareja', async () => {
    await guardar('t1', 45000);
    cliente.db.run(sql`INSERT INTO postings VALUES ('suelto', 't1', 'banco', '999', 'COP', NULL)`);

    // La transacción deja de cuadrar y la suma global también.
    const rotas = invariantesRotas();
    expect(rotas).toContain('transaccion-cuadrada');
    expect(rotas).toContain('suma-global-cero');
  });

  it('detecta un apunte huérfano cuando las claves foráneas están apagadas', async () => {
    await guardar('t1', 45000);
    // Es el estado por defecto de SQLite en el dispositivo, así que el
    // verificador tiene que poder encontrarlo.
    cliente.db.run(sql`PRAGMA foreign_keys = OFF`);
    cliente.db.run(
      sql`INSERT INTO postings VALUES ('huerfano', 'no-existe', 'banco', '1', 'COP', NULL)`,
    );

    const reporte = checkLedger(cliente.db);
    expect(reporte.violaciones.map((v) => v.invariante)).toContain('apunte-sin-transaccion');
  });

  it('detecta una cuenta borrada por debajo, dejando apuntes contra ella', async () => {
    await guardar('t1', 45000);
    cliente.db.run(sql`PRAGMA foreign_keys = OFF`);
    cliente.db.run(sql`DELETE FROM accounts WHERE id = 'gasto'`);

    expect(invariantesRotas()).toContain('cuenta-existe');
  });

  it('detecta una transacción que se quedó sin apuntes', async () => {
    await guardar('t1', 45000);
    cliente.db.run(sql`DELETE FROM postings WHERE transaction_id = 't1'`);

    expect(invariantesRotas()).toContain('transaccion-con-dos-apuntes');
  });

  it('reporta un monto ilegible sin caerse, y sigue revisando', async () => {
    await guardar('t1', 45000);
    await guardar('t2', 12000);
    cliente.db.run(sql`UPDATE postings SET amount = 'no-es-un-numero' WHERE id = 't1:0000'`);

    const reporte = checkLedger(cliente.db);

    // Lo que importa: no lanza. Un diagnóstico que se cae con el primer
    // problema no sirve para diagnosticar nada.
    expect(reporte.violaciones.map((v) => v.invariante)).toContain('apunte-legible');
    expect(reporte.revisado.apuntes).toBe(4);
  });

  it('reporta una moneda desconocida en una cuenta sin caerse', async () => {
    await guardar('t1', 45000);
    cliente.db.run(sql`UPDATE accounts SET currency = 'XYZ' WHERE id = 'banco'`);

    const rotas = invariantesRotas();
    expect(rotas).toContain('cuenta-legible');
    // Al no poder leerse la cuenta, sus apuntes quedan contra una cuenta que
    // para el verificador no existe. Las dos cosas se reportan.
    expect(rotas).toContain('cuenta-existe');
  });

  it('detecta un apunte en moneda distinta a la de su cuenta', async () => {
    await guardar('t1', 45000);
    cliente.db.run(sql`UPDATE postings SET currency = 'USD' WHERE transaction_id = 't1'`);

    expect(invariantesRotas()).toContain('moneda-del-apunte');
  });

  it('borrar una transacción deja el ledger cuadrado', async () => {
    await guardar('t1', 45000);
    await guardar('t2', 12000);

    await transacciones.delete(transactionId('t1'));

    const reporte = checkLedger(cliente.db);
    expect(reporte.sano).toBe(true);
    expect(reporte.revisado).toEqual({ cuentas: 2, transacciones: 1, apuntes: 2 });
  });

  it('el detalle nombra lo que hay que ir a mirar', async () => {
    await guardar('t1', 45000);
    cliente.db.run(sql`UPDATE postings SET amount = '1' WHERE transaction_id = 't1'`);

    const violacion = mustExist(
      checkLedger(cliente.db).violaciones.find((v) => v.invariante === 'transaccion-cuadrada'),
    );
    expect(violacion.detalle).toContain('t1');
  });
});
