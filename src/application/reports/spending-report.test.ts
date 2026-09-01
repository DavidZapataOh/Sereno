import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { entradasYSalidas, porCategoria, porMes, type ReportDeps } from './spending-report';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const COP = 'COP' as const;
const HOY = '2026-09-15T10:00:00.000-05:00';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: COP }),
  );
  for (const [slug, kind] of [
    ['mercado', 'gasto'],
    ['transporte-publico', 'gasto'],
    ['restaurantes', 'gasto'],
    ['salario', 'ingreso'],
  ] as const) {
    await accounts.save(
      createAccount({ id: categoryAccountId(slug), owner, kind, nombre: slug, currency: COP }),
    );
  }

  const d: ReportDeps = { accounts, clock: () => HOY };
  return { ...d, accounts, transactions };
}

const mover = (
  d: Awaited<ReturnType<typeof deps>>,
  id: string,
  categoria: string,
  monto: bigint,
  fecha: string,
) =>
  d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'movimiento',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(-monto, COP) },
        { accountId: categoryAccountId(categoria), amount: money(monto, COP) },
      ],
    }),
  );

describe('porCategoria', () => {
  it('el gasto sale del ledger, del mes pedido', async () => {
    const d = await deps();
    await mover(d, 'a', 'mercado', 600_000n, '2026-09-05T10:00:00.000-05:00');
    await mover(d, 'b', 'transporte-publico', 200_000n, '2026-09-06T10:00:00.000-05:00');

    const filas = await porCategoria(d, { owner, mes: '2026-09' });
    expect(filas.map((f) => f.categoria)).toEqual(['mercado', 'transporte-publico']);
    expect(filas[0]?.total.amount).toBe(600_000n);
  });

  /** La pregunta es «en qué se me va»: lo que más pesa va primero. */
  it('ordena de mayor a menor', async () => {
    const d = await deps();
    await mover(d, 'a', 'transporte-publico', 200_000n, '2026-09-05T10:00:00.000-05:00');
    await mover(d, 'b', 'mercado', 600_000n, '2026-09-06T10:00:00.000-05:00');

    expect((await porCategoria(d, { owner, mes: '2026-09' }))[0]?.categoria).toBe('mercado');
  });

  /** Tres al 33,3 % dan 99,9, y quien lo lea se pregunta dónde está el que falta. */
  it('los porcentajes suman 100 exacto', async () => {
    const d = await deps();
    for (const [i, cat] of ['mercado', 'transporte-publico', 'restaurantes'].entries()) {
      await mover(d, `x-${String(i)}`, cat, 100_000n, '2026-09-05T10:00:00.000-05:00');
    }

    const suma = (await porCategoria(d, { owner, mes: '2026-09' })).reduce(
      (acc, f) => acc + f.porcentaje,
      0,
    );
    expect(Math.round(suma * 10) / 10).toBe(100);
  });

  it('una categoría sin gasto no aparece', async () => {
    const d = await deps();
    await mover(d, 'a', 'mercado', 600_000n, '2026-09-05T10:00:00.000-05:00');

    expect((await porCategoria(d, { owner, mes: '2026-09' })).map((f) => f.categoria)).toEqual([
      'mercado',
    ]);
  });

  it('un gasto de otro mes no cuenta', async () => {
    const d = await deps();
    await mover(d, 'a', 'mercado', 600_000n, '2026-08-05T10:00:00.000-05:00');

    expect(await porCategoria(d, { owner, mes: '2026-09' })).toEqual([]);
  });

  it('no mezcla los datos de otro propietario', async () => {
    const d = await deps();
    await mover(d, 'a', 'mercado', 600_000n, '2026-09-05T10:00:00.000-05:00');

    expect(await porCategoria(d, { owner: ownerId('otro'), mes: '2026-09' })).toEqual([]);
  });
});

describe('porMes', () => {
  it('devuelve exactamente los meses pedidos, en orden', async () => {
    const d = await deps();

    const filas = await porMes(d, { owner, categoria: 'mercado', meses: 3, hasta: '2026-09' });
    expect(filas.map((f) => f.mes)).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  /** Con años de historial, mil filas no se leen y tardan. */
  it('nunca devuelve más filas que meses pedidos', async () => {
    const d = await deps();
    for (const mes of ['07', '08', '09']) {
      for (const dia of ['05', '10', '15', '20']) {
        await mover(
          d,
          `m-${mes}-${dia}`,
          'mercado',
          50_000n,
          `2026-${mes}-${dia}T10:00:00.000-05:00`,
        );
      }
    }

    expect(
      await porMes(d, { owner, categoria: 'mercado', meses: 3, hasta: '2026-09' }),
    ).toHaveLength(3);
  });

  it('agrega el mes entero en una fila', async () => {
    const d = await deps();
    await mover(d, 'a', 'mercado', 100_000n, '2026-09-05T10:00:00.000-05:00');
    await mover(d, 'b', 'mercado', 200_000n, '2026-09-20T10:00:00.000-05:00');

    const septiembre = (
      await porMes(d, { owner, categoria: 'mercado', meses: 1, hasta: '2026-09' })
    )[0];
    expect(septiembre?.total.amount).toBe(300_000n);
  });

  it('cruza el fin de año', async () => {
    const d = await deps();

    const filas = await porMes(d, { owner, categoria: 'mercado', meses: 3, hasta: '2027-01' });
    expect(filas.map((f) => f.mes)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('entradasYSalidas', () => {
  it('entradas y salidas del mismo mes van en la misma fila', async () => {
    const d = await deps();
    await mover(d, 'gasto', 'mercado', 600_000n, '2026-09-05T10:00:00.000-05:00');
    await d.transactions.save(
      createTransaction({
        id: transactionId('sueldo'),
        owner,
        fecha: '2026-09-01T10:00:00.000-05:00',
        descripcion: 'sueldo',
        origen: { fuente: 'manual', referencia: null },
        postings: [
          { accountId: banco, amount: money(3_000_000, COP) },
          { accountId: categoryAccountId('salario'), amount: money(-3_000_000, COP) },
        ],
      }),
    );

    const septiembre = (await entradasYSalidas(d, { owner, meses: 1, hasta: '2026-09' }))[0];
    expect(septiembre?.entra.amount).toBe(3_000_000n);
    expect(septiembre?.sale.amount).toBe(600_000n);
  });

  it('un mes sin nada sale en ceros, no falta', async () => {
    const d = await deps();

    const filas = await entradasYSalidas(d, { owner, meses: 2, hasta: '2026-09' });
    expect(filas).toHaveLength(2);
    expect(filas[0]?.entra.amount).toBe(0n);
  });
});

describe('rendimiento con historial largo', () => {
  /**
   * Con seis meses de datos reales esto no se nota, y con dos años sí. Se
   * comprueba ahora porque después ya está en el teléfono de alguien.
   */
  it('dos años de movimientos no tardan', async () => {
    const d = await deps();
    for (let mes = 0; mes < 24; mes += 1) {
      const total = 2025 * 12 + mes;
      const etiqueta = `${String(Math.floor(total / 12))}-${String((total % 12) + 1).padStart(2, '0')}`;
      for (let i = 0; i < 20; i += 1) {
        await mover(
          d,
          `carga-${etiqueta}-${String(i)}`,
          'mercado',
          30_000n,
          `${etiqueta}-10T10:00:00.000-05:00`,
        );
      }
    }

    const arranque = Date.now();
    await porCategoria(d, { owner, mes: '2026-09' });
    await porMes(d, { owner, categoria: 'mercado', meses: 12, hasta: '2026-09' });

    expect(Date.now() - arranque).toBeLessThan(3000);
  });
});
