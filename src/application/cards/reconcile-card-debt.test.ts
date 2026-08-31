import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import type { LedgerDeps } from '../ledger/register-adjustment';

import { reconcileCardDebt } from './reconcile-card-debt';

const owner = ownerId('david');
const rappi = accountId('rappicard:tarjeta');
const ahorros = accountId('bancolombia:ahorros');
const gastos = accountId('sistema:gastos-sin-clasificar');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: rappi, owner, kind: 'pasivo', nombre: 'RappiCard', currency: 'COP' }),
  );
  await accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  const d: LedgerDeps = {
    accounts,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => '2026-08-31T10:00:00.000-05:00',
  };
  return { ...d, accounts, transactions };
}

const deudaDe = async (d: Awaited<ReturnType<typeof deps>>) =>
  -(await d.accounts.balanceOf(rappi)).amount;

/** Una compra con la tarjeta: sube la deuda. */
async function comprar(d: Awaited<ReturnType<typeof deps>>, monto: number) {
  await d.transactions.save(
    createTransaction({
      id: transactionId(`compra-${String(monto)}`),
      owner,
      fecha: '2026-08-31T09:00:00.000-05:00',
      descripcion: 'COMERCIO',
      origen: { fuente: 'rappicard', referencia: `c${String(monto)}` },
      postings: [
        { accountId: rappi, amount: money(-monto, 'COP') },
        { accountId: gastos, amount: money(monto, 'COP') },
      ],
    }),
  );
}

describe('reconcileCardDebt', () => {
  /**
   * El caso que rompía el sprint: la tarjeta arranca en cero, muestra el cupo
   * entero disponible, e invita a gastar plata que no hay.
   */
  it('fija la deuda que ya existía antes de conectar la tarjeta', async () => {
    const d = await deps();
    expect(await deudaDe(d)).toBe(0n);

    await reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(2_000_000, 'COP') });

    expect(await deudaDe(d)).toBe(2_000_000n);
  });

  it('las compras posteriores se suman a esa deuda', async () => {
    const d = await deps();
    await reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(2_000_000, 'COP') });

    await comprar(d, 45_000);

    expect(await deudaDe(d)).toBe(2_045_000n);
  });

  /**
   * Sirve también de conciliación: se puede repetir cuando el banco y Sereno
   * se separen, igual que contar el efectivo.
   */
  it('se puede repetir, y ajusta a lo que se diga', async () => {
    const d = await deps();
    await reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(2_000_000, 'COP') });

    await reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(1_500_000, 'COP') });

    expect(await deudaDe(d)).toBe(1_500_000n);
  });

  it('si ya cuadra, no asienta nada', async () => {
    const d = await deps();
    await reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(2_000_000, 'COP') });

    const segunda = await reconcileCardDebt(d, {
      owner,
      accountId: rappi,
      deuda: money(2_000_000, 'COP'),
    });

    expect(segunda).toBeNull();
  });

  it('deja escrito qué había y qué hay', async () => {
    const d = await deps();
    await reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(2_000_000, 'COP') });

    const ajuste = await reconcileCardDebt(d, {
      owner,
      accountId: rappi,
      deuda: money(1_500_000, 'COP'),
    });

    // Dentro de seis meses, «ajuste de 500.000» no dice nada; esto sí.
    expect(ajuste?.descripcion).toContain('2.000.000');
    expect(ajuste?.descripcion).toContain('1.500.000');
  });

  it('poner la deuda en cero es válido: la tarjeta puede estar al día', async () => {
    const d = await deps();
    await reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(2_000_000, 'COP') });

    await reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(0, 'COP') });

    expect(await deudaDe(d)).toBe(0n);
  });

  it('rechaza una deuda negativa', async () => {
    const d = await deps();

    await expect(
      reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(-1, 'COP') }),
    ).rejects.toThrow(/negativa/i);
  });

  it('rechaza una cuenta que no es un pasivo', async () => {
    const d = await deps();

    await expect(
      reconcileCardDebt(d, { owner, accountId: ahorros, deuda: money(1000, 'COP') }),
    ).rejects.toThrow(/no es una tarjeta/i);
  });

  it('rechaza una cuenta de otro propietario', async () => {
    const d = await deps();

    await expect(
      reconcileCardDebt(d, { owner: ownerId('otro'), accountId: rappi, deuda: money(1000, 'COP') }),
    ).rejects.toThrow(/No existe/);
  });

  it('rechaza otra moneda', async () => {
    const d = await deps();

    await expect(
      reconcileCardDebt(d, { owner, accountId: rappi, deuda: money(100, 'USD') }),
    ).rejects.toThrow(/moneda/i);
  });
});
