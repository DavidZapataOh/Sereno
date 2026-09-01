import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { rate, type Rate } from '@/domain/rates/rate';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryRateRepository } from '@/test/fakes/in-memory-rate-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';
import { createInMemorySnapshotRepository } from '@/test/fakes/in-memory-snapshot-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { netWorthSeries, recordSnapshot, type SnapshotDeps } from './record-snapshot';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const wallet = accountId('wallet:solana:USDC');

const TRM = rate({
  desde: 'USD',
  hacia: 'COP',
  valor: 320_279n,
  escala: 2,
  origen: 'TRM oficial',
  momento: '2026-08-29T00:00:00.000-05:00',
});
const PRECIO_USDC = rate({
  desde: 'USDC',
  hacia: 'USD',
  valor: 100_018_000n,
  escala: 8,
  origen: 'Binance',
  momento: '2026-08-31T10:00:00.000-05:00',
});
/** El dólar al doble. Sirve para comprobar que el pasado no se recalcula. */
const TRM_MUY_DISTINTA = rate({
  ...TRM,
  valor: 640_558n,
  momento: '2026-09-01T00:00:00.000-05:00',
});

async function deps(tasas: Rate[] = [TRM, PRECIO_USDC]) {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  const d: SnapshotDeps & { transactions: typeof transactions } = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    reconciliations: createInMemoryReconciliationRepository(),
    rates: createInMemoryRateRepository(tasas),
    snapshots: createInMemorySnapshotRepository(),
    clock: () => '2026-08-31T10:00:00.000-05:00',
  };
  return { ...d, accounts, transactions };
}

const asentar = async (
  d: Awaited<ReturnType<typeof deps>>,
  id: string,
  cuenta: ReturnType<typeof accountId>,
  monto: bigint,
  currency: 'COP' | 'USDC',
) => {
  await d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha: '2026-08-30T10:00:00.000-05:00',
      descripcion: 'Saldo',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: cuenta, amount: money(monto, currency) },
        { accountId: systemAccountId('ajustes'), amount: money(-monto, currency) },
      ],
    }),
  );
};

describe('recordSnapshot', () => {
  it('guarda una instantánea por día, con las tasas que usó', async () => {
    const d = await deps();
    await d.accounts.save(
      createAccount({ id: wallet, owner, kind: 'activo', nombre: 'USDC', currency: 'USDC' }),
    );
    await asentar(d, 'cripto', wallet, 10_000_000n, 'USDC');

    const guardada = await recordSnapshot(d, { owner });

    expect(guardada.dia).toBe('2026-08-31');
    expect(guardada.tasas).toContain('TRM oficial');
    expect(guardada.tasas).toContain('2026-08-29');
  });

  /**
   * Si todo está en pesos no hizo falta convertir nada, y decirlo así evita
   * que dentro de un mes se lea como «no se pudo valorar».
   */
  it('sin conversiones lo dice sin sonar a fallo', async () => {
    const d = await deps();
    await asentar(d, 'saldo', banco, 80_000n, 'COP');

    const guardada = await recordSnapshot(d, { owner });

    expect(guardada.patrimonio.amount).toBe(80_000n);
    expect(guardada.tasas).toMatch(/todo estaba en pesos/);
  });

  it('el día sale del reloj, en hora de Colombia', async () => {
    // Las 22:00 en Colombia son el día siguiente en UTC: sin la zona, la
    // instantánea de la noche caería en el día equivocado.
    const d = { ...(await deps()), clock: () => '2026-08-31T22:00:00.000-05:00' };

    expect((await recordSnapshot(d, { owner })).dia).toBe('2026-08-31');
  });

  /** Dos arranques el mismo día no son dos puntos en la serie. */
  it('la del mismo día se reemplaza, no se duplica', async () => {
    const d = await deps();
    await asentar(d, 'primero', banco, 80_000n, 'COP');
    await recordSnapshot(d, { owner });

    await asentar(d, 'segundo', banco, 20_000n, 'COP');
    await recordSnapshot(d, { owner });

    const serie = await netWorthSeries(d, {
      owner,
      desde: '2026-08-01',
      hasta: '2026-08-31',
    });
    expect(serie).toHaveLength(1);
    expect(serie[0]?.patrimonio.amount).toBe(100_000n);
  });

  /**
   * Lo que hace que la serie signifique algo. Si se recalculara con las tasas
   * de hoy, la línea del pasado cambiaría cada mañana y no mediría nada: un
   * dólar que sube haría parecer que uno ahorró en marzo.
   */
  it('el pasado no se recalcula: cada punto guarda su propio valor', async () => {
    const d = await deps();
    await d.accounts.save(
      createAccount({ id: wallet, owner, kind: 'activo', nombre: 'USDC', currency: 'USDC' }),
    );
    await asentar(d, 'cripto', wallet, 10_000_000n, 'USDC');

    const del30 = await recordSnapshot(d, { owner, dia: '2026-08-30' });

    // Cambian las tasas: el dólar al doble.
    d.rates = createInMemoryRateRepository([TRM_MUY_DISTINTA, PRECIO_USDC]);
    await recordSnapshot(d, { owner, dia: '2026-08-31' });

    const serie = await netWorthSeries(d, { owner, desde: '2026-08-01', hasta: '2026-08-31' });

    // Lo que importa: el punto viejo NO cambió al cambiar las tasas.
    expect(serie[0]?.patrimonio.amount).toBe(del30.patrimonio.amount);
    expect(serie[0]?.tasas).toContain('2026-08-29');
    // Y el nuevo sí refleja la tasa nueva. No es el doble exacto: la
    // conversión trunca una vez al final, así que doblar la tasa deja un peso
    // de diferencia. Eso es correcto —no se inventan fracciones de peso—.
    const nuevo = serie[1]?.patrimonio.amount ?? 0n;
    expect(nuevo).toBeGreaterThan(del30.patrimonio.amount);
    expect(nuevo - del30.patrimonio.amount * 2n).toBeLessThanOrEqual(1n);
  });

  /** Un cero en la gráfica se lee como «se quedó sin nada». */
  it('un día sin instantánea es un hueco, no un cero', async () => {
    const d = await deps();
    await recordSnapshot(d, { owner, dia: '2026-08-28' });
    await recordSnapshot(d, { owner, dia: '2026-08-30' });

    const serie = await netWorthSeries(d, { owner, desde: '2026-08-01', hasta: '2026-08-31' });

    expect(serie.map((s) => s.dia)).toEqual(['2026-08-28', '2026-08-30']);
    expect(serie.map((s) => s.dia)).not.toContain('2026-08-29');
  });

  it('la serie sale en orden y solo del rango pedido', async () => {
    const d = await deps();
    for (const dia of ['2026-07-31', '2026-08-15', '2026-08-31', '2026-09-01']) {
      await recordSnapshot(d, { owner, dia });
    }

    const serie = await netWorthSeries(d, { owner, desde: '2026-08-01', hasta: '2026-08-31' });

    expect(serie.map((s) => s.dia)).toEqual(['2026-08-15', '2026-08-31']);
  });

  /**
   * Lo que sí es un aviso: había algo en otra moneda y no se pudo valorar.
   * Se dice aparte de «no hizo falta convertir», que son cosas distintas.
   */
  it('lo que quedó sin valorar se anota en la instantánea', async () => {
    const d = await deps([]);
    await d.accounts.save(
      createAccount({ id: wallet, owner, kind: 'activo', nombre: 'USDC', currency: 'USDC' }),
    );
    await asentar(d, 'cripto', wallet, 10_000_000n, 'USDC');

    expect((await recordSnapshot(d, { owner })).tasas).toMatch(/1 sin valorar/);
  });

  it('no devuelve la serie de otro propietario', async () => {
    const d = await deps();
    await recordSnapshot(d, { owner, dia: '2026-08-31' });

    const ajena = await netWorthSeries(d, {
      owner: ownerId('otra-persona'),
      desde: '2026-08-01',
      hasta: '2026-08-31',
    });
    expect(ajena).toEqual([]);
  });
});
