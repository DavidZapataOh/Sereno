import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
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

import { requiredIncome, type RequiredIncomeDeps } from './required-income';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const meta = accountId('meta:viaje');
const COP = 'COP' as const;
const HOY = '2026-09-15T10:00:00.000-05:00';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: COP }),
  );

  const d: RequiredIncomeDeps = {
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
    inicio: '2026-09-01',
  };
  return { ...d, accounts, transactions, fondos: d.fondos, cards: d.cards };
}

const cobrar = async (
  d: Awaited<ReturnType<typeof deps>>,
  id: string,
  monto: bigint,
  fecha: string,
) => {
  const cuenta = categoryAccountId('salario');
  if ((await d.accounts.findById(cuenta)) === null) {
    await d.accounts.save(
      createAccount({ id: cuenta, owner, kind: 'ingreso', nombre: 'Salario', currency: COP }),
    );
  }
  await d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'sueldo',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(monto, COP) },
        { accountId: cuenta, amount: money(-monto, COP) },
      ],
    }),
  );
};

describe('requiredIncome', () => {
  it('las tres cifras crecen en orden', async () => {
    const d = await deps();
    await d.fondos.guardar({
      accountId: meta,
      owner,
      nombre: 'Viaje',
      tipo: 'meta',
      objetivo: money(6_000_000, COP),
      proximaFecha: '2027-09-01',
      cadaMeses: null,
    });

    const { requerido } = await requiredIncome(d, { owner });
    expect(requerido.minimo.amount).toBeLessThanOrEqual(requerido.sostener.amount);
    expect(requerido.sostener.amount).toBeLessThanOrEqual(requerido.conMetas.amount);
  });

  it('con metas incluye los aportes', async () => {
    const d = await deps();
    await d.fondos.guardar({
      accountId: meta,
      owner,
      nombre: 'Viaje',
      tipo: 'meta',
      objetivo: money(6_000_000, COP),
      proximaFecha: '2027-09-01',
      cadaMeses: null,
    });

    const { requerido } = await requiredIncome(d, { owner });
    expect(requerido.conMetas.amount).toBeGreaterThan(requerido.sostener.amount);
  });

  /** Lo declarado es lo que uno cree ganar; el ledger sabe lo que entró. */
  it('el ingreso observado sale de las categorías de ingreso del ledger', async () => {
    const d = await deps();
    await cobrar(d, 'jul', 3_000_000n, '2026-07-30T10:00:00.000-05:00');
    await cobrar(d, 'ago', 3_000_000n, '2026-08-30T10:00:00.000-05:00');

    const r = await requiredIncome(d, { owner });
    expect(r.observado?.amount).toBe(3_000_000n);
  });

  /** Un promedio de un mes no es un promedio: hay que decir de cuántos es. */
  it('dice sobre cuántos meses se observó', async () => {
    const d = await deps();
    await cobrar(d, 'ago', 3_000_000n, '2026-08-30T10:00:00.000-05:00');

    expect((await requiredIncome(d, { owner })).meses).toBe(1);
  });

  it('la brecha es lo que falta para sostener el ritmo actual', async () => {
    const d = await deps();
    await cobrar(d, 'ago', 1_000_000n, '2026-08-30T10:00:00.000-05:00');

    const r = await requiredIncome(d, { owner });
    expect(r.brecha?.amount).toBe(r.requerido.sostener.amount - 1_000_000n);
  });

  it('con ingreso de sobra, la brecha es negativa y eso es bueno', async () => {
    const d = await deps();
    await cobrar(d, 'ago', 9_000_000n, '2026-08-30T10:00:00.000-05:00');

    expect((await requiredIncome(d, { owner })).brecha?.amount).toBeLessThan(0n);
  });

  /** Devolver cero diría «no ganas nada», que es otra afirmación. */
  it('sin historia de ingresos lo dice, en vez de devolver cero', async () => {
    const d = await deps();

    const r = await requiredIncome(d, { owner });
    expect(r.observado).toBeNull();
    expect(r.meses).toBe(0);
    expect(r.brecha).toBeNull();
  });

  it('no mezcla el ingreso de otro propietario', async () => {
    const d = await deps();
    await cobrar(d, 'ago', 3_000_000n, '2026-08-30T10:00:00.000-05:00');

    expect((await requiredIncome(d, { owner: ownerId('otro') })).requerido.minimo.amount).toBe(0n);
  });

  it('sin nada declarado, las tres cifras son cero y no falla', async () => {
    const d = await deps();

    const { requerido } = await requiredIncome(d, { owner });
    expect(requerido.conMetas.amount).toBe(0n);
  });
});
