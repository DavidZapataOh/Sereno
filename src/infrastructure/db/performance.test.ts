import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import { createTransaction } from '@/domain/ledger/transaction';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';
import { money } from '@/domain/money/money';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');

/** Cinco años a unas ochenta transacciones al mes. */
const VOLUMEN = 5000;
const POR_PAGINA = 50;

/**
 * Presupuestos de tiempo con historial realista.
 *
 * Una consulta que va bien con diez transacciones puede ser inservible con cinco
 * años de historial, y para entonces el diseño ya está en producción.
 *
 * Se siembra una sola vez para las cuatro medidas: sembrar por prueba mediría
 * sobre todo la siembra.
 */
describe('rendimiento con historial realista', () => {
  jest.setTimeout(120_000);

  let cliente: ReturnType<typeof createTestDb>;
  let repo: TransactionRepository;
  let cuentas: AccountRepository;

  const medir = async (operacion: () => Promise<unknown>): Promise<number> => {
    const inicio = Date.now();
    await operacion();
    return Date.now() - inicio;
  };

  beforeAll(async () => {
    cliente = createTestDb();
    cuentas = createDrizzleAccountRepository(cliente.db);
    repo = createDrizzleTransactionRepository(cliente.db);

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

    for (let i = 0; i < VOLUMEN; i += 1) {
      const fecha = new Date(Date.UTC(2021, 0, 1) + i * 8 * 3600 * 1000).toISOString();
      await repo.save(
        createTransaction({
          id: transactionId(`t${String(i).padStart(5, '0')}`),
          owner,
          fecha,
          descripcion: `Movimiento ${String(i)}`,
          origen: { fuente: 'siembra', referencia: `ref-${String(i)}` },
          postings: [
            { accountId: accountId('banco'), amount: money(-(1000 + i), 'COP') },
            { accountId: accountId('gasto'), amount: money(1000 + i, 'COP') },
          ],
        }),
      );
    }
  });

  afterAll(() => {
    cliente.close();
  });

  it('sembró las cinco mil transacciones', async () => {
    const pagina = await repo.list(owner, undefined, { limit: 1 });

    expect(pagina.nextCursor).not.toBeNull();
    expect(pagina.items).toHaveLength(1);
  });

  it('la primera página se sirve en menos de 200 ms', async () => {
    const duracion = await medir(() => repo.list(owner, undefined, { limit: POR_PAGINA }));

    expect(duracion).toBeLessThan(200);
  });

  it('la última página cuesta lo mismo que la primera', async () => {
    const primera = await repo.list(owner, undefined, { limit: POR_PAGINA });
    const duracionPrimera = await medir(() => repo.list(owner, undefined, { limit: POR_PAGINA }));

    // Se recorre hasta la última de las cien páginas y se mide esa consulta
    // sola. Con `OFFSET`, esta medida crecería linealmente con el número de
    // página; con cursor tiene que quedarse plana.
    let cursor = primera.nextCursor;
    let ultimoCursor = cursor;
    let paginas = 1;
    while (cursor !== null) {
      ultimoCursor = cursor;
      const siguiente = await repo.list(owner, undefined, { limit: POR_PAGINA, cursor });
      cursor = siguiente.nextCursor;
      paginas += 1;
    }

    const duracionUltima = await medir(() =>
      repo.list(owner, undefined, { limit: POR_PAGINA, cursor: ultimoCursor ?? undefined }),
    );

    expect(paginas).toBe(VOLUMEN / POR_PAGINA);
    expect(duracionUltima).toBeLessThan(200);
    // Comparación relativa además de la absoluta: es lo que distingue «rápido
    // por tener poca máquina» de «rápido porque no depende de la página».
    expect(duracionUltima).toBeLessThan(Math.max(duracionPrimera * 4, 50));
  });

  it('el saldo de una cuenta con diez mil apuntes se calcula en menos de 500 ms', async () => {
    const duracion = await medir(() => cuentas.balanceOf(accountId('banco')));

    expect(duracion).toBeLessThan(500);
    expect((await cuentas.balanceOf(accountId('banco'))).amount).toBeLessThan(0n);
  });

  it('filtrar por rango de fechas se sirve en menos de 300 ms', async () => {
    const duracion = await medir(() =>
      repo.list(owner, {
        desde: '2023-01-01T00:00:00.000Z',
        hasta: '2023-12-31T23:59:59.999Z',
      }),
    );

    expect(duracion).toBeLessThan(300);
  });

  it('la deduplicación de un movimiento ya visto es inmediata', async () => {
    // Es la consulta que más veces se repite: una por movimiento en cada
    // sincronización. Si escanea la tabla, la importación se vuelve cuadrática.
    const duracion = await medir(async () => {
      for (let i = 0; i < 200; i += 1) {
        await repo.existsByOrigin(owner, 'siembra', `ref-${String(i)}`);
      }
    });

    expect(duracion).toBeLessThan(300);
  });
});
