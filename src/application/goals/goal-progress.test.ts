import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemorySinkingRepository } from '@/test/fakes/in-memory-sinking-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { goalProgress, type GoalDeps } from './goal-progress';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const viaje = accountId('meta:viaje');
const seguro = accountId('fondo:seguro');
const COP = 'COP' as const;
const HOY = '2026-09-15T10:00:00.000-05:00';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: COP }),
  );

  const fondos = createInMemorySinkingRepository();
  await fondos.guardar({
    accountId: viaje,
    owner,
    nombre: 'Viaje',
    tipo: 'meta',
    objetivo: money(6_000_000, COP),
    proximaFecha: '2027-09-01',
    cadaMeses: null,
  });
  await fondos.guardar({
    accountId: seguro,
    owner,
    nombre: 'Seguro',
    tipo: 'gasto',
    objetivo: money(1_200_000, COP),
    proximaFecha: '2027-09-01',
    cadaMeses: 12,
  });

  const d: GoalDeps = { accounts, fondos, clock: () => HOY, inicio: '2026-09-15' };
  return { ...d, accounts, transactions };
}

/** Un ingreso que entra a una categoría de ingreso, en un mes. */
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

describe('goalProgress', () => {
  /** Una meta es un fondo con otra intención: los gastos no son metas. */
  it('solo devuelve las metas, no los fondos de gasto', async () => {
    const d = await deps();

    const { metas } = await goalProgress(d, owner);
    expect(metas.map((m) => m.fondo.accountId)).toEqual([viaje]);
  });

  it('dice cuánto hay que apartar al mes entre todas', async () => {
    const d = await deps();

    expect((await goalProgress(d, owner)).aporteTotal.amount).toBeGreaterThan(0n);
  });

  it('una meta recién creada está al día, no atrasada', async () => {
    const d = await deps();

    expect((await goalProgress(d, owner)).metas[0]?.ritmo.estado).toBe('al-dia');
  });

  /** Lo declarado es lo que uno cree ganar; el ledger sabe lo que entró. */
  it('el ingreso observado sale de las categorías de ingreso del ledger', async () => {
    const d = await deps();
    await cobrar(d, 'jul', 3_000_000n, '2026-07-30T10:00:00.000-05:00');
    await cobrar(d, 'ago', 3_000_000n, '2026-08-30T10:00:00.000-05:00');

    expect((await goalProgress(d, owner)).ingresoObservado?.amount).toBe(3_000_000n);
  });

  /** Devolver cero diría «no ganas nada», que es otra cosa. */
  it('sin historia de ingresos devuelve null, no cero', async () => {
    const d = await deps();

    const resumen = await goalProgress(d, owner);
    expect(resumen.ingresoObservado).toBeNull();
    expect(resumen.cabeEnElIngreso).toBeNull();
  });

  it('dice que cabe cuando el aporte entra en el ingreso', async () => {
    const d = await deps();
    await cobrar(d, 'jul', 3_000_000n, '2026-07-30T10:00:00.000-05:00');
    await cobrar(d, 'ago', 3_000_000n, '2026-08-30T10:00:00.000-05:00');

    expect((await goalProgress(d, owner)).cabeEnElIngreso).toBe(true);
  });

  /** «Aparta cuatro millones al mes» con un ingreso de uno es burlarse. */
  it('dice que no cabe cuando el aporte se pasa del ingreso', async () => {
    const d = await deps();
    await cobrar(d, 'jul', 100_000n, '2026-07-30T10:00:00.000-05:00');
    await cobrar(d, 'ago', 100_000n, '2026-08-30T10:00:00.000-05:00');

    expect((await goalProgress(d, owner)).cabeEnElIngreso).toBe(false);
  });

  it('no mezcla las metas de otro propietario', async () => {
    const d = await deps();

    expect((await goalProgress(d, ownerId('otro'))).metas).toEqual([]);
  });
});
