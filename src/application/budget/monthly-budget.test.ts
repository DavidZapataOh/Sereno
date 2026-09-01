import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryBudgetRepository } from '@/test/fakes/in-memory-budget-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { assign, coverOverspend } from './assign';
import { copiarDelMesAnterior, monthlyBudget, type BudgetDeps } from './monthly-budget';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const COP = 'COP' as const;
const HOY = '2026-09-15T10:00:00.000-05:00';
const CATEGORIAS = ['mercado', 'transporte', 'restaurantes'];

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: COP }),
  );
  for (const slug of CATEGORIAS) {
    await accounts.save(
      createAccount({
        id: categoryAccountId(slug),
        owner,
        kind: 'gasto',
        nombre: slug,
        currency: COP,
      }),
    );
  }

  const d: BudgetDeps = {
    accounts,
    presupuesto: createInMemoryBudgetRepository(),
    clock: () => HOY,
  };
  return { ...d, accounts, transactions };
}

/** Un gasto de una categoría, en una fecha. */
const gastar = (
  d: Awaited<ReturnType<typeof deps>>,
  id: string,
  categoria: string,
  monto: bigint,
  fecha: string,
) =>
  d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'compra',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(-monto, COP) },
        { accountId: categoryAccountId(categoria), amount: money(monto, COP) },
      ],
    }),
  );

const entrada = {
  owner,
  mes: '2026-09',
  categorias: CATEGORIAS,
  ingresoDelMes: money(3_200_000, COP),
};

describe('monthlyBudget', () => {
  /** Dos cortes de `balanceOf` y una resta: nada guardado. */
  it('lo gastado en cada sobre sale del ledger', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-09', categoria: 'mercado', monto: money(600_000, COP) });
    await gastar(d, 'g1', 'mercado', 250_000n, '2026-09-10T10:00:00.000-05:00');

    const sobre = (await monthlyBudget(d, entrada)).sobres[0];
    expect(sobre?.gastado.amount).toBe(250_000n);
    expect(sobre?.queda.amount).toBe(350_000n);
  });

  it('un gasto del mes pasado no cuenta en este', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-09', categoria: 'mercado', monto: money(600_000, COP) });
    await gastar(d, 'viejo', 'mercado', 900_000n, '2026-08-20T10:00:00.000-05:00');

    expect((await monthlyBudget(d, entrada)).sobres[0]?.gastado.amount).toBe(0n);
  });

  /**
   * Esconderlo haría que el total del mes no cuadre con el ledger, y entonces
   * el presupuesto mentiría por omisión.
   */
  it('un gasto de una categoría sin sobre aparece igual, como no presupuestado', async () => {
    const d = await deps();
    await gastar(d, 'g1', 'restaurantes', 120_000n, '2026-09-05T10:00:00.000-05:00');

    const presupuesto = await monthlyBudget(d, entrada);
    expect(presupuesto.noPresupuestado).toEqual([
      { categoria: 'restaurantes', gastado: money(120_000, COP) },
    ]);
  });

  it('el reparto dice cuánto falta por asignar', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-09', categoria: 'mercado', monto: money(2_000_000, COP) });

    const { reparto } = await monthlyBudget(d, entrada);
    expect(reparto.sinAsignar.amount).toBe(1_200_000n);
    expect(reparto.completo).toBe(false);
  });

  it('está completo cuando no queda nada sin asignar', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-09', categoria: 'mercado', monto: money(2_000_000, COP) });
    await assign(d, {
      owner,
      mes: '2026-09',
      categoria: 'transporte',
      monto: money(1_200_000, COP),
    });

    expect((await monthlyBudget(d, entrada)).reparto.completo).toBe(true);
  });

  /** Informa la decisión mientras se toma, sin tomarla. */
  it('trae el histórico de cada categoría y cuántos meses lo respaldan', async () => {
    const d = await deps();
    await gastar(d, 'j', 'mercado', 500_000n, '2026-07-10T10:00:00.000-05:00');
    await gastar(d, 'a', 'mercado', 700_000n, '2026-08-10T10:00:00.000-05:00');

    const historico = (await monthlyBudget(d, entrada)).historico.find(
      (h) => h.categoria === 'mercado',
    );
    expect(historico?.meses).toBe(2);
    expect(historico?.promedio?.amount).toBe(600_000n);
  });

  /** Un promedio de un mes no es un promedio: es un dato disfrazado de consejo. */
  it('con menos de dos meses de historia no enseña promedio', async () => {
    const d = await deps();
    await gastar(d, 'a', 'mercado', 700_000n, '2026-08-10T10:00:00.000-05:00');

    const historico = (await monthlyBudget(d, entrada)).historico.find(
      (h) => h.categoria === 'mercado',
    );
    expect(historico?.meses).toBe(1);
    expect(historico?.promedio).toBeNull();
  });

  it('no mezcla el presupuesto de otro propietario', async () => {
    const d = await deps();
    await assign(d, {
      owner: ownerId('otro'),
      mes: '2026-09',
      categoria: 'mercado',
      monto: money(1, COP),
    });

    expect((await monthlyBudget(d, entrada)).sobres).toEqual([]);
  });
});

describe('copiarDelMesAnterior', () => {
  /** Lo que mantiene corta la sesión mensual sin romper el método. */
  it('trae todas las asignaciones del mes pasado', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-08', categoria: 'mercado', monto: money(600_000, COP) });
    await assign(d, { owner, mes: '2026-08', categoria: 'transporte', monto: money(180_000, COP) });

    expect(await copiarDelMesAnterior(d, { owner, mes: '2026-09' })).toBe(2);
    expect((await monthlyBudget(d, entrada)).sobres).toHaveLength(2);
  });

  /** Pisar lo de este mes sería deshacer una decisión ya tomada. */
  it('no pisa lo que ya se asignó este mes', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-08', categoria: 'mercado', monto: money(600_000, COP) });
    await assign(d, { owner, mes: '2026-09', categoria: 'mercado', monto: money(900_000, COP) });

    await copiarDelMesAnterior(d, { owner, mes: '2026-09' });

    const sobre = (await monthlyBudget(d, entrada)).sobres.find(
      (s) => s.envelope.categoria === 'mercado',
    );
    expect(sobre?.envelope.asignado.amount).toBe(900_000n);
  });

  it('sin mes anterior no copia nada y no falla', async () => {
    const d = await deps();

    expect(await copiarDelMesAnterior(d, { owner, mes: '2026-09' })).toBe(0);
  });
});

describe('coverOverspend', () => {
  it('mueve asignación de un sobre a otro', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-09', categoria: 'mercado', monto: money(600_000, COP) });
    await assign(d, { owner, mes: '2026-09', categoria: 'transporte', monto: money(200_000, COP) });

    await coverOverspend(d, {
      owner,
      mes: '2026-09',
      desde: 'mercado',
      hacia: 'transporte',
      monto: money(100_000, COP),
    });

    const sobres = (await monthlyBudget(d, entrada)).sobres;
    expect(sobres.find((s) => s.envelope.categoria === 'mercado')?.envelope.asignado.amount).toBe(
      500_000n,
    );
    expect(
      sobres.find((s) => s.envelope.categoria === 'transporte')?.envelope.asignado.amount,
    ).toBe(300_000n);
  });

  /** No se ha gastado nada nuevo: meterlo al ledger inventaría un movimiento. */
  it('no asienta ninguna transacción', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-09', categoria: 'mercado', monto: money(600_000, COP) });
    const antes = d.transactions.all().length;

    await coverOverspend(d, {
      owner,
      mes: '2026-09',
      desde: 'mercado',
      hacia: 'transporte',
      monto: money(100_000, COP),
    });

    expect(d.transactions.all()).toHaveLength(antes);
  });

  it('el total asignado no cambia al mover entre sobres', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-09', categoria: 'mercado', monto: money(600_000, COP) });
    const antes = (await monthlyBudget(d, entrada)).reparto.asignado.amount;

    await coverOverspend(d, {
      owner,
      mes: '2026-09',
      desde: 'mercado',
      hacia: 'transporte',
      monto: money(100_000, COP),
    });

    expect((await monthlyBudget(d, entrada)).reparto.asignado.amount).toBe(antes);
  });

  /** Dejar el origen en negativo movería el problema, no lo resolvería. */
  it('no deja el sobre de origen en negativo', async () => {
    const d = await deps();
    await assign(d, { owner, mes: '2026-09', categoria: 'mercado', monto: money(50_000, COP) });

    await expect(
      coverOverspend(d, {
        owner,
        mes: '2026-09',
        desde: 'mercado',
        hacia: 'transporte',
        monto: money(100_000, COP),
      }),
    ).rejects.toThrow(/no tiene tanto/);
  });

  it('no se puede cubrir un sobre consigo mismo', async () => {
    const d = await deps();

    await expect(
      coverOverspend(d, {
        owner,
        mes: '2026-09',
        desde: 'mercado',
        hacia: 'mercado',
        monto: money(1, COP),
      }),
    ).rejects.toThrow(/consigo mismo/);
  });
});
