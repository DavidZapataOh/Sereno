import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryCardRepository } from '@/test/fakes/in-memory-card-repository';
import { createInMemoryCategoryRepository } from '@/test/fakes/in-memory-category-repository';
import { createInMemoryClassificationRepository } from '@/test/fakes/in-memory-classification-repository';
import { createInMemoryDebtRepository } from '@/test/fakes/in-memory-debt-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { debtOverview, type DebtOverviewDeps } from './debt-overview';

const owner = ownerId('david');
const tarjeta = accountId('rappicard:tarjeta');
const prestamo = accountId('prestamo:banco');
const banco = accountId('bancolombia:ahorros');
const HOY = '2026-09-15T10:00:00.000-05:00';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  for (const [id, nombre, kind] of [
    [banco, 'Bancolombia', 'activo'],
    [tarjeta, 'RappiCard', 'pasivo'],
    [prestamo, 'Crédito', 'pasivo'],
  ] as const) {
    await accounts.save(createAccount({ id, owner, kind, nombre, currency: 'COP' }));
  }
  const d: DebtOverviewDeps = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    categories: createInMemoryCategoryRepository(),
    classifications: createInMemoryClassificationRepository(),
    cards: createInMemoryCardRepository(),
    debts: createInMemoryDebtRepository(),
    clock: () => HOY,
  };
  return { ...d, accounts, transactions };
}

const mover = (
  d: Awaited<ReturnType<typeof deps>>,
  id: string,
  cuenta: typeof tarjeta,
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
        { accountId: cuenta, amount: money(monto, 'COP') },
        { accountId: systemAccountId('ajustes'), amount: money(-monto, 'COP') },
      ],
    }),
  );

describe('debtOverview', () => {
  it('el total es la suma de los saldos de los pasivos, en positivo', async () => {
    const d = await deps();
    await mover(d, 'a', tarjeta, -1_500_000n, '2026-09-01T10:00:00.000-05:00');
    await mover(d, 'b', prestamo, -500_000n, '2026-09-01T10:00:00.000-05:00');

    expect((await debtOverview(d, { owner })).total.amount).toBe(2_000_000n);
  });

  it('no cuenta los activos como deuda', async () => {
    const d = await deps();
    await mover(d, 'a', banco, 3_000_000n, '2026-09-01T10:00:00.000-05:00');

    expect((await debtOverview(d, { owner })).total.amount).toBe(0n);
  });

  /**
   * Sin guardar nada: el ledger sabe lo que se debía cualquier día, porque
   * tiene todos los asientos con su fecha.
   */
  it('lo de hace treinta días sale del ledger, no de una instantánea', async () => {
    const d = await deps();
    await mover(d, 'vieja', tarjeta, -2_000_000n, '2026-08-01T10:00:00.000-05:00');
    await mover(d, 'pago', tarjeta, 500_000n, '2026-09-10T10:00:00.000-05:00');

    const o = await debtOverview(d, { owner });

    expect(o.total.amount).toBe(1_500_000n);
    expect(o.hace30Dias?.amount).toBe(2_000_000n);
  });

  it('deber menos que hace un mes da un cambio negativo', async () => {
    const d = await deps();
    await mover(d, 'vieja', tarjeta, -2_000_000n, '2026-08-01T10:00:00.000-05:00');
    await mover(d, 'pago', tarjeta, 500_000n, '2026-09-10T10:00:00.000-05:00');

    expect((await debtOverview(d, { owner })).cambio?.amount).toBe(-500_000n);
  });

  it('deber más da un cambio positivo', async () => {
    const d = await deps();
    await mover(d, 'vieja', tarjeta, -1_000_000n, '2026-08-01T10:00:00.000-05:00');
    await mover(d, 'compra', tarjeta, -300_000n, '2026-09-10T10:00:00.000-05:00');

    expect((await debtOverview(d, { owner })).cambio?.amount).toBe(300_000n);
  });

  /**
   * Cero diría «no cambió nada», y lo que pasa es que no había nada con qué
   * comparar. Son cosas distintas y se enseñan distinto.
   */
  it('sin historia de hace un mes, el cambio es null y no cero', async () => {
    const d = await deps();
    await mover(d, 'nueva', tarjeta, -1_000_000n, '2026-09-10T10:00:00.000-05:00');

    const o = await debtOverview(d, { owner });

    expect(o.hace30Dias).toBeNull();
    expect(o.cambio).toBeNull();
  });

  it('sin deudas el total es cero', async () => {
    expect((await debtOverview(await deps(), { owner })).total.amount).toBe(0n);
  });

  it('lista las deudas con su saldo', async () => {
    const d = await deps();
    await mover(d, 'a', prestamo, -400_000n, '2026-09-01T10:00:00.000-05:00');

    const o = await debtOverview(d, { owner });

    expect(o.deudas.find((x) => x.accountId === prestamo)?.saldo.amount).toBe(-400_000n);
  });

  it('no mezcla las deudas de otro propietario', async () => {
    const d = await deps();
    await d.accounts.save(
      createAccount({
        id: accountId('ajena'),
        owner: ownerId('otro'),
        kind: 'pasivo',
        nombre: 'x',
        currency: 'COP',
      }),
    );

    expect((await debtOverview(d, { owner })).deudas.map((x) => x.accountId)).not.toContain(
      'ajena',
    );
  });

  it('sin nada que venza, la próxima obligación es null', async () => {
    expect((await debtOverview(await deps(), { owner })).proxima).toBeNull();
  });
});
