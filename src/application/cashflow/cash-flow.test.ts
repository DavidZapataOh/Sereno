import { createCreditCard } from '@/domain/cards/card';
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
import { createInMemoryRateRepository } from '@/test/fakes/in-memory-rate-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';
import { createInMemorySinkingRepository } from '@/test/fakes/in-memory-sinking-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { cashFlow, type CashFlowDeps } from './cash-flow';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const tarjeta = accountId('rappicard:tarjeta');
const fondo = accountId('fondo:seguro');
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
  await transactions.save(
    createTransaction({
      id: transactionId('apertura'),
      owner,
      fecha: '2026-09-01T10:00:00.000-05:00',
      descripcion: 'Apertura',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(2_000_000, COP) },
        { accountId: systemAccountId('ajustes'), amount: money(-2_000_000, COP) },
      ],
    }),
  );

  const d: CashFlowDeps = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    categories: createInMemoryCategoryRepository(),
    classifications: createInMemoryClassificationRepository(),
    reconciliations: createInMemoryReconciliationRepository(),
    rates: createInMemoryRateRepository(),
    cards: createInMemoryCardRepository(),
    debts: createInMemoryDebtRepository(),
    fondos: createInMemorySinkingRepository(),
    clock: () => HOY,
  };
  return { ...d, accounts, transactions, cards: d.cards, fondos: d.fondos };
}

describe('cashFlow', () => {
  it('arranca del saldo que hay hoy en las cuentas de activo', async () => {
    const d = await deps();

    const p = await cashFlow(d, { owner, meses: 3 });
    expect(p.meses[0]?.saldoInicial.amount).toBe(2_000_000n);
  });

  it('proyecta los meses pedidos', async () => {
    const d = await deps();

    expect((await cashFlow(d, { owner, meses: 6 })).meses).toHaveLength(6);
  });

  /** Los aportes son decisiones tomadas: cuentan como comprometido. */
  it('los aportes a fondos entran como comprometido', async () => {
    const d = await deps();
    await d.fondos.guardar({
      accountId: fondo,
      owner,
      nombre: 'Seguro',
      tipo: 'gasto',
      objetivo: money(1_200_000, COP),
      proximaFecha: '2027-09-01',
      cadaMeses: 12,
    });

    const p = await cashFlow(d, { owner, meses: 3 });
    expect(p.meses[0]?.comprometido.amount).toBeLessThan(0n);
    expect(p.supuestos.join(' ')).toMatch(/apartas cada mes/);
  });

  /**
   * Contar una tarjeta sin ciclo cerrado como cero diría que no cuesta nada.
   * Se dice cuántas quedan fuera, en vez de inventar un monto.
   */
  it('una tarjeta sin monto conocido no se cuenta como cero: se declara', async () => {
    const d = await deps();
    await d.cards.save(
      createCreditCard({
        accountId: tarjeta,
        owner,
        cupo: money(2_000_000, COP),
        diaDeCorte: 15,
        diaDePago: 5,
      }),
    );

    const p = await cashFlow(d, { owner, meses: 3 });
    expect(p.supuestos.join(' ')).toMatch(/sin monto conocido/);
  });

  it('declara que el gasto habitual todavía no está incluido', async () => {
    const d = await deps();

    expect((await cashFlow(d, { owner, meses: 3 })).supuestos.join(' ')).toMatch(/gasto habitual/);
  });

  it('sin obligaciones ni fondos, el saldo se mantiene', async () => {
    const d = await deps();

    const p = await cashFlow(d, { owner, meses: 3 });
    expect(p.meses.at(-1)?.saldoFinal.amount).toBe(2_000_000n);
    expect(p.primerMesEnRojo).toBeNull();
  });

  it('avisa del primer mes en rojo cuando lo comprometido se come el saldo', async () => {
    const d = await deps();
    await d.fondos.guardar({
      accountId: fondo,
      owner,
      nombre: 'Meta enorme',
      tipo: 'meta',
      objetivo: money(9_000_000, COP),
      proximaFecha: '2027-03-01',
      cadaMeses: null,
    });

    expect((await cashFlow(d, { owner, meses: 6 })).primerMesEnRojo).not.toBeNull();
  });

  it('no mezcla los datos de otro propietario', async () => {
    const d = await deps();

    expect(
      (await cashFlow(d, { owner: ownerId('otro'), meses: 3 })).meses[0]?.saldoInicial.amount,
    ).toBe(0n);
  });
});
