import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { conversionAccountId } from '@/domain/ledger/system-accounts';
import { imbalanceOf } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { convertCurrency } from './convert-currency';
import { ensureSystemAccounts } from './ensure-system-accounts';
import type { LedgerDeps } from './register-adjustment';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const wallet = accountId('wallet:solana');
const puenteCOP = conversionAccountId('COP');
const puenteUSDC = conversionAccountId('USDC');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  await accounts.save(
    createAccount({ id: wallet, owner, kind: 'activo', nombre: 'Solana', currency: 'USDC' }),
  );
  const d: LedgerDeps = {
    accounts,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => '2026-08-31T10:00:00.000-05:00',
  };
  return { ...d, accounts, transactions };
}

const base = {
  owner,
  desde: banco,
  hacia: wallet,
  entrega: money(400_000, 'COP'),
  recibe: money(100_000_000n, 'USDC'),
};

const saldo = async (d: Awaited<ReturnType<typeof deps>>, id: typeof banco) =>
  (await d.accounts.balanceOf(id)).amount;

describe('convertCurrency', () => {
  it('deja las dos patas cuadradas, cada una en su moneda', async () => {
    const d = await deps();

    const r = await convertCurrency(d, base);

    expect(imbalanceOf(r.salida.postings)).toHaveLength(0);
    expect(imbalanceOf(r.entrada.postings)).toHaveLength(0);
    expect(await saldo(d, banco)).toBe(-400_000n);
    expect(await saldo(d, wallet)).toBe(100_000_000n);
  });

  /**
   * Lo que hace que esto no sea un apaño: los puentes quedan con las dos
   * mitades, y valorados en pesos dicen cuánto se ganó o se perdió con la
   * tasa. Son dos cuentas y no una porque **una cuenta tiene una sola
   * moneda**: `balanceOf` suma con la de la cuenta, así que un puente con
   * pesos y USDC dentro no se podría consultar.
   */
  it('los puentes quedan con las dos mitades, uno por moneda', async () => {
    const d = await deps();

    await convertCurrency(d, base);

    expect(await saldo(d, puenteCOP)).toBe(400_000n);
    expect(await saldo(d, puenteUSDC)).toBe(-100_000_000n);
  });

  it('los puentes se crean solos la primera vez, y no se duplican', async () => {
    const d = await deps();

    await convertCurrency(d, base);
    await convertCurrency(d, base);

    expect(d.accounts.all().filter((c) => c.id.startsWith('sistema:conversiones'))).toHaveLength(2);
  });

  it('no convierte una moneda en sí misma: eso es una transferencia', async () => {
    const d = await deps();

    await expect(convertCurrency(d, { ...base, recibe: money(400_000, 'COP') })).rejects.toThrow(
      /transferencia/i,
    );
  });

  it('rechaza montos que no son positivos por cualquiera de los dos lados', async () => {
    const d = await deps();

    await expect(convertCurrency(d, { ...base, entrega: money(0, 'COP') })).rejects.toThrow();
    await expect(convertCurrency(d, { ...base, recibe: money(-1n, 'USDC') })).rejects.toThrow();
  });

  /**
   * Meter USDC en una cuenta de pesos es la forma más silenciosa de corromper
   * un ledger: la transacción cuadra y no significa nada.
   */
  it('rechaza una cuenta cuya moneda no es la del monto', async () => {
    const d = await deps();

    await expect(convertCurrency(d, { ...base, hacia: banco })).rejects.toThrow(/moneda/i);
    await expect(convertCurrency(d, { ...base, desde: wallet })).rejects.toThrow(/moneda/i);
  });

  it('rechaza una cuenta de otro propietario', async () => {
    const d = await deps();

    await expect(convertCurrency(d, { ...base, owner: ownerId('otro') })).rejects.toThrow(
      /No existe/,
    );
  });

  it('deja escrita la tasa implícita en la descripción', async () => {
    const d = await deps();

    const r = await convertCurrency(d, base);

    // «conversión» no dice nada dentro de seis meses; esto sí.
    expect(r.salida.descripcion).toContain('400.000');
    expect(r.salida.descripcion).toContain('USDC');
    expect(r.entrada.descripcion).toBe(r.salida.descripcion);
  });

  /**
   * Una pata suelta deja el puente descuadrado, y un puente descuadrado es una
   * posición de cambio que no existió.
   */
  it('si la segunda pata falla, no queda la primera suelta', async () => {
    const d = await deps();
    const guardarReal = d.transactions.save.bind(d.transactions);
    let veces = 0;
    d.transactions.save = (tx) => {
      veces += 1;
      return veces === 2 ? Promise.reject(new Error('base llena')) : guardarReal(tx);
    };

    await expect(convertCurrency(d, base)).rejects.toThrow('base llena');

    expect(d.transactions.all()).toHaveLength(0);
    expect(await saldo(d, banco)).toBe(0n);
  });
});
