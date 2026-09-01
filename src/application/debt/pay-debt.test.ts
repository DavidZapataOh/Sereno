import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryDebtRepository } from '@/test/fakes/in-memory-debt-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { payDebt, type PayDebtDeps } from './pay-debt';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const prestamo = accountId('prestamo:banco');
const primo = accountId('persona:primo');
const INTERESES = categoryAccountId('intereses-de-credito');
const HOY = '2026-09-01T10:00:00.000-05:00';

/** Un millón de deuda: el interés mensual al 24 % E.A. son 18.088 pesos. */
const SALDO = 1_000_000n;

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  for (const [id, nombre, kind] of [
    [banco, 'Bancolombia', 'activo'],
    [prestamo, 'Crédito', 'pasivo'],
    [primo, 'Le debo al primo', 'pasivo'],
  ] as const) {
    await accounts.save(createAccount({ id, owner, kind, nombre, currency: 'COP' }));
  }
  const debts = createInMemoryDebtRepository();
  await debts.guardar({
    accountId: prestamo,
    owner,
    tipo: 'prestamo',
    nombre: 'Crédito',
    tasa: { valor: 0.24, tipo: 'EA' },
    cuotasTotales: 36,
    diaDePago: 15,
  });
  await debts.guardar({
    accountId: primo,
    owner,
    tipo: 'persona',
    nombre: 'Le debo al primo',
    tasa: null,
    cuotasTotales: null,
    diaDePago: null,
  });

  const d: PayDebtDeps = {
    accounts,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => HOY,
    debts,
  };
  return { ...d, accounts, transactions, debts };
}

/** Deja saldo en el banco y deuda en la cuenta indicada. */
async function conSaldos(d: Awaited<ReturnType<typeof deps>>, deuda = prestamo) {
  await d.transactions.save(
    createTransaction({
      id: transactionId('apertura'),
      owner,
      fecha: '2026-08-01T10:00:00.000-05:00',
      descripcion: 'Apertura',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(5_000_000, 'COP') },
        { accountId: deuda, amount: money(-SALDO, 'COP') },
        { accountId: systemAccountId('ajustes'), amount: money(SALDO - 5_000_000n, 'COP') },
      ],
    }),
  );
}

describe('payDebt', () => {
  /**
   * Lo que este plan existe para que salga bien. Si la cuota entera fuera
   * gasto, pagar deuda parecería empobrecerse; y si fuera toda capital, los
   * intereses desaparecerían del «en qué se me va la plata».
   */
  it('asienta los intereses como gasto y el capital contra la deuda', async () => {
    const d = await deps();
    await conSaldos(d);

    const r = await payDebt(d, {
      owner,
      deuda: prestamo,
      desde: banco,
      monto: money(100_000, 'COP'),
    });

    expect(r.intereses.amount).toBe(18_088n);
    expect(r.capital.amount).toBe(81_912n);
    expect((await d.accounts.balanceOf(INTERESES)).amount).toBe(18_088n);
  });

  it('las dos patas suman la cuota exacta', async () => {
    const d = await deps();
    await conSaldos(d);

    const r = await payDebt(d, {
      owner,
      deuda: prestamo,
      desde: banco,
      monto: money(100_000, 'COP'),
    });

    expect(r.intereses.amount + r.capital.amount).toBe(100_000n);
  });

  it('la transacción cuadra', async () => {
    const d = await deps();
    await conSaldos(d);
    await payDebt(d, { owner, deuda: prestamo, desde: banco, monto: money(100_000, 'COP') });

    const tx = d.transactions.all().at(-1);
    const suma = tx?.postings.reduce((acc, p) => acc + p.amount.amount, 0n);
    expect(suma).toBe(0n);
  });

  it('la deuda baja solo el capital, no la cuota entera', async () => {
    const d = await deps();
    await conSaldos(d);
    const antes = (await d.accounts.balanceOf(prestamo)).amount;

    const r = await payDebt(d, {
      owner,
      deuda: prestamo,
      desde: banco,
      monto: money(100_000, 'COP'),
    });

    expect((await d.accounts.balanceOf(prestamo)).amount).toBe(antes + r.capital.amount);
  });

  /**
   * Pagar capital es mover, no perder: sale del banco y entra a reducir el
   * pasivo. Lo único que empobrece son los intereses.
   */
  it('el patrimonio baja solo por los intereses', async () => {
    const d = await deps();
    await conSaldos(d);
    const patrimonioAntes =
      (await d.accounts.balanceOf(banco)).amount + (await d.accounts.balanceOf(prestamo)).amount;

    const r = await payDebt(d, {
      owner,
      deuda: prestamo,
      desde: banco,
      monto: money(100_000, 'COP'),
    });

    const patrimonioDespues =
      (await d.accounts.balanceOf(banco)).amount + (await d.accounts.balanceOf(prestamo)).amount;
    expect(patrimonioAntes - patrimonioDespues).toBe(r.intereses.amount);
  });

  it('una deuda con una persona no genera pata de intereses', async () => {
    const d = await deps();
    await conSaldos(d, primo);

    const r = await payDebt(d, { owner, deuda: primo, desde: banco, monto: money(50_000, 'COP') });

    expect(r.intereses.amount).toBe(0n);
    expect(r.capital.amount).toBe(50_000n);
    expect(await d.accounts.findById(INTERESES)).toBeNull();
  });

  it('un pasivo sin términos declarados se paga sin intereses', async () => {
    const d = await deps();
    await d.debts.borrar(prestamo);
    await conSaldos(d);

    expect(
      (await payDebt(d, { owner, deuda: prestamo, desde: banco, monto: money(50_000, 'COP') }))
        .intereses.amount,
    ).toBe(0n);
  });

  it('rechaza pagar una cuenta que no es un pasivo', async () => {
    const d = await deps();

    await expect(
      payDebt(d, { owner, deuda: banco, desde: banco, monto: money(1_000, 'COP') }),
    ).rejects.toThrow();
  });

  it('rechaza un monto que no es positivo', async () => {
    const d = await deps();

    await expect(
      payDebt(d, { owner, deuda: prestamo, desde: banco, monto: money(0, 'COP') }),
    ).rejects.toThrow(/positivo/i);
  });

  it('rechaza monedas distintas', async () => {
    const d = await deps();

    await expect(
      payDebt(d, { owner, deuda: prestamo, desde: banco, monto: money(1, 'USDC') }),
    ).rejects.toThrow(/moneda/i);
  });

  it('rechaza una deuda de otro propietario', async () => {
    const d = await deps();

    await expect(
      payDebt(d, {
        owner: ownerId('otro'),
        deuda: prestamo,
        desde: banco,
        monto: money(1_000, 'COP'),
      }),
    ).rejects.toThrow(/No existe/);
  });

  it('no deja pagar una deuda consigo misma', async () => {
    const d = await deps();

    await expect(
      payDebt(d, { owner, deuda: prestamo, desde: prestamo, monto: money(1_000, 'COP') }),
    ).rejects.toThrow(/ella misma/);
  });
});
