import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryCardRepository } from '@/test/fakes/in-memory-card-repository';
import { createInMemoryDebtRepository } from '@/test/fakes/in-memory-debt-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { compareStrategies, type CompareDeps } from './compare-strategies';

const owner = ownerId('david');
const tarjeta = accountId('rappicard:tarjeta');
const prestamo = accountId('prestamo:banco');
const HOY = '2026-09-01T10:00:00.000-05:00';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  for (const [id, nombre] of [
    [tarjeta, 'RappiCard'],
    [prestamo, 'Crédito'],
  ] as const) {
    await accounts.save(createAccount({ id, owner, kind: 'pasivo', nombre, currency: 'COP' }));
  }
  const d: CompareDeps = {
    accounts,
    debts: createInMemoryDebtRepository(),
    cards: createInMemoryCardRepository(),
    clock: () => HOY,
  };
  return { ...d, accounts, transactions };
}

const deber = (d: Awaited<ReturnType<typeof deps>>, cuenta: typeof tarjeta, cuanto: bigint) =>
  d.transactions.save(
    createTransaction({
      id: transactionId(`d-${cuenta}`),
      owner,
      fecha: '2026-08-01T10:00:00.000-05:00',
      descripcion: 'Compra',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: cuenta, amount: money(-cuanto, 'COP') },
        { accountId: systemAccountId('ajustes'), amount: money(cuanto, 'COP') },
      ],
    }),
  );

describe('compareStrategies', () => {
  it('compara las dos con las deudas del ledger', async () => {
    const d = await deps();
    await deber(d, tarjeta, 2_000_000n);
    await d.debts.guardar({
      accountId: tarjeta,
      owner,
      tipo: 'tarjeta',
      nombre: 'RappiCard',
      tasa: { valor: 0.28, tipo: 'EA' },
      cuotasTotales: null,
      diaDePago: 5,
    });

    const r = await compareStrategies(d, { owner, presupuesto: money(500_000, 'COP') });

    expect(r.avalancha.estado).toBe('sale');
    expect(r.bolaDeNieve.estado).toBe('sale');
  });

  it('los saldos salen del ledger, no de nada guardado', async () => {
    const d = await deps();
    await deber(d, prestamo, 1_000_000n);

    const r = await compareStrategies(d, { owner, presupuesto: money(300_000, 'COP') });

    expect(r.avalancha.estado).toBe('sale');
    if (r.avalancha.estado !== 'sale') return;
    const capital = r.avalancha.meses
      .flatMap((m) => m.pagos)
      .reduce((acc, p) => acc + p.capital.amount, 0n);
    expect(capital).toBe(1_000_000n);
  });

  /** Sin ellos, una fecha es una promesa. */
  it('declara los supuestos, y son los que se usaron de verdad', async () => {
    const d = await deps();
    await deber(d, prestamo, 1_000_000n);
    await d.debts.guardar({
      accountId: prestamo,
      owner,
      tipo: 'prestamo',
      nombre: 'Crédito',
      tasa: { valor: 0.24, tipo: 'EA' },
      cuotasTotales: 36,
      diaDePago: 15,
    });

    const r = await compareStrategies(d, { owner, presupuesto: money(300_000, 'COP') });

    expect(r.supuestos.join(' ')).toContain('300.000');
    expect(r.supuestos.join(' ')).toContain('24.0 %');
    expect(r.supuestos.join(' ')).toMatch(/no vuelvas a usar/);
  });

  it('una deuda sin tasa declarada aparece en los supuestos como tal', async () => {
    const d = await deps();
    await deber(d, prestamo, 500_000n);

    const r = await compareStrategies(d, { owner, presupuesto: money(200_000, 'COP') });

    expect(r.supuestos.join(' ')).toMatch(/sin tasa declarada/);
  });

  it('sin presupuesto suficiente, las dos dicen que no convergen', async () => {
    const d = await deps();
    await deber(d, tarjeta, 20_000_000n);
    await d.debts.guardar({
      accountId: tarjeta,
      owner,
      tipo: 'tarjeta',
      nombre: 'RappiCard',
      tasa: { valor: 0.35, tipo: 'EA' },
      cuotasTotales: null,
      diaDePago: 5,
    });

    const r = await compareStrategies(d, { owner, presupuesto: money(10_000, 'COP') });

    expect(r.avalancha.estado).toBe('no-converge');
    expect(r.bolaDeNieve.estado).toBe('no-converge');
  });

  it('sin deudas sale hoy, sin error', async () => {
    const d = await deps();

    const r = await compareStrategies(d, { owner, presupuesto: money(100_000, 'COP') });

    expect(r.avalancha.estado).toBe('sale');
  });

  it('las deudas saldadas no entran a la simulación', async () => {
    const d = await deps();
    await deber(d, prestamo, 1_000_000n);

    const r = await compareStrategies(d, { owner, presupuesto: money(300_000, 'COP') });

    expect(r.avalancha.estado).toBe('sale');
    if (r.avalancha.estado !== 'sale') return;
    const ids = new Set(r.avalancha.meses.flatMap((m) => m.pagos).map((p) => p.deudaId));
    expect(ids.has(tarjeta)).toBe(false);
  });
});
