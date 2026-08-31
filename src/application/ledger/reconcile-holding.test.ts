import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { ensureSystemAccounts } from './ensure-system-accounts';
import { reconcileHolding, type SaldoExterno } from './reconcile-holding';
import type { LedgerDeps } from './register-adjustment';

const owner = ownerId('david');
const cuenta = accountId('binance:USDC');
const AHORA = '2026-08-31T10:00:00.000-05:00';

const saldoDe = (amount: bigint): SaldoExterno => ({
  accountId: cuenta,
  nombre: 'USDC en Binance',
  currency: 'USDC',
  cantidad: money(amount, 'USDC'),
  leidoEn: AHORA,
  motivo: 'Saldo leído de Binance: USDC',
});

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  const d: LedgerDeps = {
    accounts,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => AHORA,
  };
  return { ...d, accounts, transactions };
}

describe('reconcileHolding', () => {
  it('la primera lectura deja el saldo entero', async () => {
    const d = await deps();

    expect(await reconcileHolding(d, owner, saldoDe(85_761n))).toBe(true);
    expect((await d.accounts.balanceOf(cuenta)).amount).toBe(85_761n);
  });

  /**
   * Lo que hace que esto se pueda correr en cada arranque sin ensuciar nada.
   */
  it('una lectura igual no asienta nada', async () => {
    const d = await deps();
    await reconcileHolding(d, owner, saldoDe(85_761n));

    expect(await reconcileHolding(d, owner, saldoDe(85_761n))).toBe(false);
    expect(d.accounts.postings.filter((p) => p.accountId === cuenta)).toHaveLength(1);
  });

  it('una lectura distinta asienta solo la diferencia', async () => {
    const d = await deps();
    await reconcileHolding(d, owner, saldoDe(100n));

    await reconcileHolding(d, owner, saldoDe(130n));

    expect((await d.accounts.balanceOf(cuenta)).amount).toBe(130n);
    expect(d.accounts.postings.filter((p) => p.accountId === cuenta)).toHaveLength(2);
  });

  it('crea la cuenta con su moneda y su nombre', async () => {
    const d = await deps();
    await reconcileHolding(d, owner, saldoDe(1n));

    const creada = await d.accounts.findById(cuenta);
    expect(creada?.currency).toBe('USDC');
    expect(creada?.nombre).toBe('USDC en Binance');
    expect(creada?.kind).toBe('activo');
  });

  /**
   * Entre catorce cadenas y un exchange, crear cuenta para cada cero sería
   * llenar la lista de renglones vacíos.
   */
  it('un cero que nunca tuvo nada no crea cuenta', async () => {
    const d = await deps();

    expect(await reconcileHolding(d, owner, saldoDe(0n))).toBe(false);
    expect(await d.accounts.findById(cuenta)).toBeNull();
  });

  /** Pero lo que tuvo saldo y baja a cero se queda: eso es historia. */
  it('la cuenta que tuvo saldo y baja a cero se queda en cero', async () => {
    const d = await deps();
    await reconcileHolding(d, owner, saldoDe(500n));

    expect(await reconcileHolding(d, owner, saldoDe(0n))).toBe(true);
    expect((await d.accounts.balanceOf(cuenta)).amount).toBe(0n);
    expect(await d.accounts.findById(cuenta)).not.toBeNull();
  });

  it('el ajuste lleva la fecha de la lectura, no la de hoy', async () => {
    const d = await deps();
    const ayer = '2026-08-30T08:00:00.000-05:00';
    await reconcileHolding(d, owner, { ...saldoDe(7n), leidoEn: ayer });

    const asiento = d.transactions.all().at(-1);
    expect(asiento?.fecha).toBe(ayer);
  });

  it('el motivo del ajuste dice de dónde salió el saldo', async () => {
    const d = await deps();
    await reconcileHolding(d, owner, saldoDe(7n));

    expect(d.transactions.all().at(-1)?.descripcion).toContain('Binance');
  });
});
