import { createCreditCard } from '@/domain/cards/card';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryCardRepository } from '@/test/fakes/in-memory-card-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import { payCard } from '../ledger/pay-card';

import { cardSummary } from './card-summary';

const owner = ownerId('david');
const rappi = accountId('rappicard:tarjeta');
const nu = accountId('nu:tarjeta');
const ahorros = accountId('bancolombia:ahorros');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const cards = createInMemoryCardRepository();
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  for (const [id, nombre] of [
    [rappi, 'RappiCard'],
    [nu, 'Nu'],
  ] as const) {
    await accounts.save(createAccount({ id, owner, kind: 'pasivo', nombre, currency: 'COP' }));
    await cards.save(
      createCreditCard({
        accountId: id,
        owner,
        cupo: money(3_000_000, 'COP'),
        diaDeCorte: 15,
        diaDePago: 5,
      }),
    );
  }
  return {
    accounts,
    cards,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => '2026-08-28T10:00:00.000-05:00',
  };
}

/** Una compra deja deuda: el pasivo aumenta con crédito, o sea saldo negativo. */
async function comprar(d: Awaited<ReturnType<typeof deps>>, monto: bigint) {
  await d.transactions.save({
    id: `rappicard:compra-${String(monto)}` as never,
    owner,
    fecha: '2026-08-20T10:00:00.000-05:00',
    descripcion: 'COMERCIO',
    origen: { fuente: 'rappicard', referencia: 'x' },
    postings: [
      { accountId: rappi, amount: money(-monto, 'COP') },
      { accountId: accountId('sistema:gastos-sin-clasificar'), amount: money(monto, 'COP') },
    ],
  });
}

describe('cardSummary', () => {
  it('deriva el disponible del ledger, no de un saldo guardado', async () => {
    const d = await deps();
    await comprar(d, 1_200_000n);

    const resumen = await cardSummary(d, { owner, accountId: rappi });

    expect(resumen?.deuda.amount).toBe(1_200_000n);
    expect(resumen?.disponible.amount).toBe(1_800_000n);
    expect(resumen?.usado).toBeCloseTo(0.4, 5);
  });

  it('pagar la tarjeta libera cupo', async () => {
    const d = await deps();
    await comprar(d, 1_200_000n);
    await payCard(d, { owner, desde: ahorros, tarjeta: rappi, monto: money(500_000, 'COP') });

    const resumen = await cardSummary(d, { owner, accountId: rappi });

    expect(resumen?.deuda.amount).toBe(700_000n);
    expect(resumen?.disponible.amount).toBe(2_300_000n);
  });

  it('sin deuda, el disponible es el cupo entero', async () => {
    const d = await deps();

    expect((await cardSummary(d, { owner, accountId: rappi }))?.disponible.amount).toBe(3_000_000n);
  });

  /**
   * Nu solo manda correo del pago de la cuota, no de las compras: la deuda
   * que se ve está incompleta. Un número redondo que parece completo miente
   * más que un hueco declarado.
   */
  it('avisa cuando la fuente no trae todas las compras', async () => {
    const d = await deps();

    expect((await cardSummary(d, { owner, accountId: nu }))?.completa).toBe(false);
  });

  it('con RappiCard sí está completa', async () => {
    const d = await deps();

    expect((await cardSummary(d, { owner, accountId: rappi }))?.completa).toBe(true);
  });

  it('una cuenta que no es tarjeta no tiene resumen', async () => {
    const d = await deps();

    expect(await cardSummary(d, { owner, accountId: ahorros })).toBeNull();
  });

  it('no devuelve la tarjeta de otro propietario', async () => {
    const d = await deps();

    expect(await cardSummary(d, { owner: ownerId('otro'), accountId: rappi })).toBeNull();
  });
});
