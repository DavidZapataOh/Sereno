import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { imbalanceOf } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { ensureSystemAccounts } from './ensure-system-accounts';
import { payCard } from './pay-card';
import type { LedgerDeps } from './register-adjustment';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');
const tarjeta = accountId('rappicard:tarjeta');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  await accounts.save(
    createAccount({ id: tarjeta, owner, kind: 'pasivo', nombre: 'RappiCard', currency: 'COP' }),
  );
  const d: LedgerDeps = {
    accounts,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => '2026-08-28T10:00:00.000-05:00',
  };
  return { ...d, accounts, transactions };
}

const base = { owner, desde: ahorros, tarjeta, monto: money(500_000, 'COP') };

describe('payCard', () => {
  it('mueve dinero del activo al pasivo, sin tocar ninguna cuenta de gasto', async () => {
    const d = await deps();

    await payCard(d, base);

    expect((await d.accounts.balanceOf(ahorros)).amount).toBe(-500_000n);
    // La deuda baja: el pasivo se acerca a cero.
    expect((await d.accounts.balanceOf(tarjeta)).amount).toBe(500_000n);
  });

  /**
   * Es el error contable más común de las apps de finanzas, y el que más
   * engaña: si el pago fuera gasto, el mayor gasto del mes sería siempre
   * pagar la tarjeta, y lo comprado se contaría dos veces.
   */
  it('no crea ni toca ninguna cuenta de gasto', async () => {
    const d = await deps();

    await payCard(d, base);

    const gastos = d.accounts.all().filter((c) => c.kind === 'gasto');
    const conApuntes = gastos.filter((c) => d.accounts.postings.some((p) => p.accountId === c.id));
    expect(conApuntes).toHaveLength(0);
  });

  it('la transacción cuadra', async () => {
    const d = await deps();
    const tx = await payCard(d, base);

    expect(imbalanceOf(tx.postings)).toHaveLength(0);
  });

  it('no deja pagar una tarjeta con ella misma', async () => {
    const d = await deps();

    await expect(payCard(d, { ...base, desde: tarjeta })).rejects.toThrow(/misma/i);
  });

  it('rechaza un monto que no es positivo', async () => {
    const d = await deps();

    await expect(payCard(d, { ...base, monto: money(0, 'COP') })).rejects.toThrow();
    await expect(payCard(d, { ...base, monto: money(-1, 'COP') })).rejects.toThrow();
  });

  /**
   * Pagar algo que no es una deuda no es pagar: es transferir. Dejarlo pasar
   * escondería el error detrás de un asiento que cuadra igual.
   */
  it('rechaza pagar una cuenta que no es un pasivo', async () => {
    const d = await deps();
    const otra = accountId('nequi:ahorros');
    await d.accounts.save(
      createAccount({ id: otra, owner, kind: 'activo', nombre: 'Nequi', currency: 'COP' }),
    );

    await expect(payCard(d, { ...base, tarjeta: otra })).rejects.toThrow(/no es una tarjeta/i);
  });

  it('rechaza una cuenta de otro propietario', async () => {
    const d = await deps();

    await expect(payCard(d, { ...base, owner: ownerId('otro') })).rejects.toThrow(/No existe/);
  });

  it('rechaza monedas distintas', async () => {
    const d = await deps();

    await expect(payCard(d, { ...base, monto: money(100, 'USD') })).rejects.toThrow(/moneda/i);
  });
});
