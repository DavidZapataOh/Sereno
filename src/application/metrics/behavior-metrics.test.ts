import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { behaviorMetrics, type BehaviorDeps } from './behavior-metrics';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const tarjeta = accountId('rappicard:tarjeta');
const COP = 'COP' as const;
const HOY = '2026-09-15T10:00:00.000-05:00';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: COP }),
  );
  await accounts.save(
    createAccount({ id: tarjeta, owner, kind: 'pasivo', nombre: 'RappiCard', currency: COP }),
  );
  for (const slug of ['salario', 'mercado']) {
    await accounts.save(
      createAccount({
        id: categoryAccountId(slug),
        owner,
        kind: slug === 'salario' ? 'ingreso' : 'gasto',
        nombre: slug,
        currency: COP,
      }),
    );
  }

  const d: BehaviorDeps = { accounts, transactions, clock: () => HOY };
  return { ...d, accounts, transactions };
}

const cobrar = (d: Awaited<ReturnType<typeof deps>>, id: string, monto: bigint, fecha: string) =>
  d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'sueldo',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(monto, COP) },
        { accountId: categoryAccountId('salario'), amount: money(-monto, COP) },
      ],
    }),
  );

const gastar = (d: Awaited<ReturnType<typeof deps>>, id: string, monto: bigint, fecha: string) =>
  d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'compra',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(-monto, COP) },
        { accountId: categoryAccountId('mercado'), amount: money(monto, COP) },
      ],
    }),
  );

/** Tres meses de sueldo y gasto: suficiente para las cuatro métricas. */
async function conHistoria(d: Awaited<ReturnType<typeof deps>>) {
  for (const [i, mes] of ['07', '08', '09'].entries()) {
    await cobrar(d, `sueldo-${mes}`, 3_000_000n, `2026-${mes}-01T10:00:00.000-05:00`);
    await gastar(d, `gasto-${mes}`, 2_400_000n, `2026-${mes}-10T10:00:00.000-05:00`);
    void i;
  }
}

describe('behaviorMetrics', () => {
  it('con tres meses de historia, las cuatro salen', async () => {
    const d = await deps();
    await conHistoria(d);

    const { metricas, sinDatos } = await behaviorMetrics(d, { owner });
    expect(metricas.map((m) => m.clave).sort()).toEqual([
      'antiguedad-del-dinero',
      'deuda-sobre-ingreso',
      'meses-de-colchon',
      'tasa-de-ahorro',
    ]);
    expect(sinDatos).toEqual([]);
  });

  /** Cero es una afirmación; «no lo sé» es otra. */
  it('sin datos, las métricas se listan aparte en vez de salir como cero', async () => {
    const d = await deps();

    const { metricas, sinDatos } = await behaviorMetrics(d, { owner });
    expect(metricas).toEqual([]);
    expect(sinDatos).toHaveLength(4);
  });

  it('la tasa de ahorro sale del ingreso y el gasto del ledger', async () => {
    const d = await deps();
    await conHistoria(d);

    // 3.000.000 de ingreso y 2.400.000 de gasto al mes: ahorra el 20 %.
    const tasa = (await behaviorMetrics(d, { owner })).metricas.find(
      (m) => m.clave === 'tasa-de-ahorro',
    );
    expect(tasa?.valor).toBe(20);
  });

  it('la antigüedad del dinero sale del flujo de las cuentas de activo', async () => {
    const d = await deps();
    await conHistoria(d);

    const edad = (await behaviorMetrics(d, { owner })).metricas.find(
      (m) => m.clave === 'antiguedad-del-dinero',
    );
    /**
     * Dieciséis días, no nueve, y ahí está la gracia de la métrica: como cada
     * mes sobra plata, la cola FIFO arrastra restos del mes anterior y el
     * dinero que se gasta **envejece**. Con gasto igual al ingreso se quedaría
     * clavada en nueve.
     */
    expect(edad?.valor).toBeGreaterThan(9);
    expect(edad?.valor).toBeLessThan(25);
  });

  it('la deuda sale de los pasivos', async () => {
    const d = await deps();
    await conHistoria(d);
    await d.transactions.save(
      createTransaction({
        id: transactionId('deuda'),
        owner,
        fecha: '2026-09-01T10:00:00.000-05:00',
        descripcion: 'compra con tarjeta',
        origen: { fuente: 'manual', referencia: null },
        postings: [
          { accountId: tarjeta, amount: money(-3_000_000, COP) },
          { accountId: categoryAccountId('mercado'), amount: money(3_000_000, COP) },
        ],
      }),
    );

    const ratio = (await behaviorMetrics(d, { owner })).metricas.find(
      (m) => m.clave === 'deuda-sobre-ingreso',
    );
    expect(ratio?.valor).toBe(1);
  });

  it('cada métrica dice sobre cuántos meses se calculó', async () => {
    const d = await deps();
    await conHistoria(d);

    for (const m of (await behaviorMetrics(d, { owner })).metricas) {
      expect(m.meses).toBeGreaterThanOrEqual(2);
    }
  });

  it('no mezcla los datos de otro propietario', async () => {
    const d = await deps();
    await conHistoria(d);

    expect((await behaviorMetrics(d, { owner: ownerId('otro') })).metricas).toEqual([]);
  });
});
