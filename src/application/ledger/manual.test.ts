import { assert, asyncProperty, bigInt, string } from 'fast-check';

import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { imbalanceOf } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { adjustToReconcile } from './adjust-to-reconcile';
import { ensureSystemAccounts } from './ensure-system-accounts';
import { registerAdjustment, type LedgerDeps } from './register-adjustment';
import { registerCashExpense } from './register-cash-expense';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  const d: LedgerDeps = {
    accounts,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => '2026-08-28T10:00:00.000-05:00',
  };
  return {
    ...d,
    accounts,
    transactions,
    reconciliations: createInMemoryReconciliationRepository(),
  };
}

const saldo = async (d: Awaited<ReturnType<typeof deps>>, id: string) =>
  (await d.accounts.balanceOf(accountId(id))).amount;

describe('registerAdjustment', () => {
  it('aumenta la cuenta y cuadra contra Ajustes', async () => {
    const d = await deps();
    const tx = await registerAdjustment(d, {
      owner,
      accountId: ahorros,
      amount: money(45000, 'COP'),
      motivo: 'Saldo inicial',
    });

    expect(await saldo(d, 'bancolombia:ahorros')).toBe(45000n);
    expect(await saldo(d, 'sistema:ajustes')).toBe(-45000n);
    expect(tx.origen).toEqual({ fuente: 'manual', referencia: null });
    expect(tx.descripcion).toBe('Saldo inicial');
    expect(tx.id).toBe('manual:uuid-1');
  });

  it('un monto negativo la disminuye', async () => {
    const d = await deps();
    await registerAdjustment(d, {
      owner,
      accountId: ahorros,
      amount: money(-1000, 'COP'),
      motivo: 'Comisión no vista',
    });
    expect(await saldo(d, 'bancolombia:ahorros')).toBe(-1000n);
  });

  it('exige motivo', async () => {
    const d = await deps();
    await expect(
      registerAdjustment(d, { owner, accountId: ahorros, amount: money(1, 'COP'), motivo: '   ' }),
    ).rejects.toThrow(/motivo/);
  });

  it('rechaza un monto cero', async () => {
    const d = await deps();
    await expect(
      registerAdjustment(d, { owner, accountId: ahorros, amount: money(0, 'COP'), motivo: 'x' }),
    ).rejects.toThrow(/cero/);
  });

  it('rechaza una moneda distinta a la de la cuenta', async () => {
    const d = await deps();
    await expect(
      registerAdjustment(d, { owner, accountId: ahorros, amount: money(1, 'USD'), motivo: 'x' }),
    ).rejects.toThrow(/moneda/);
  });

  it('rechaza una cuenta inexistente o ajena', async () => {
    const d = await deps();
    await expect(
      registerAdjustment(d, {
        owner: ownerId('otro'),
        accountId: ahorros,
        amount: money(1, 'COP'),
        motivo: 'x',
      }),
    ).rejects.toThrow(/cuenta/);
  });

  it('usa la fecha dada o, si no, la del reloj', async () => {
    const d = await deps();
    const conFecha = await registerAdjustment(d, {
      owner,
      accountId: ahorros,
      amount: money(1, 'COP'),
      motivo: 'x',
      fecha: '2026-01-01T00:00:00.000-05:00',
    });
    const sinFecha = await registerAdjustment(d, {
      owner,
      accountId: ahorros,
      amount: money(1, 'COP'),
      motivo: 'x',
    });
    expect(conFecha.fecha).toBe('2026-01-01T00:00:00.000-05:00');
    expect(sinFecha.fecha).toBe('2026-08-28T10:00:00.000-05:00');
  });

  it('propiedad: ningún ajuste descuadra el ledger', async () => {
    await assert(
      asyncProperty(
        bigInt({ min: -(10n ** 12n), max: 10n ** 12n }).filter((n) => n !== 0n),
        string({ minLength: 1 }).filter((m) => m.trim().length > 0),
        async (monto, motivo) => {
          const d = await deps();
          const tx = await registerAdjustment(d, {
            owner,
            accountId: ahorros,
            amount: money(monto, 'COP'),
            motivo,
          });
          expect(imbalanceOf(tx.postings)).toEqual([]);
          const saldos = await Promise.all(d.accounts.all().map((c) => d.accounts.balanceOf(c.id)));
          expect(saldos.reduce((acc, s) => acc + s.amount, 0n)).toBe(0n);
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('registerCashExpense', () => {
  it('saca del efectivo y lo lleva a gastos sin clasificar', async () => {
    const d = await deps();
    const tx = await registerCashExpense(d, {
      owner,
      amount: money(12000, 'COP'),
      descripcion: 'Almuerzo',
    });

    expect(await saldo(d, 'sistema:efectivo')).toBe(-12000n);
    expect(await saldo(d, 'sistema:gastos-sin-clasificar')).toBe(12000n);
    expect(tx.origen.fuente).toBe('manual');
  });

  it('exige monto positivo y descripción', async () => {
    const d = await deps();
    await expect(
      registerCashExpense(d, { owner, amount: money(-1, 'COP'), descripcion: 'x' }),
    ).rejects.toThrow(/positivo/);
    await expect(
      registerCashExpense(d, { owner, amount: money(1, 'COP'), descripcion: '' }),
    ).rejects.toThrow(/descripción/);
  });
});

describe('adjustToReconcile', () => {
  const conciliacion = (veredicto: 'gasto-no-capturado' | 'cuadra') => ({
    id: `rec-${veredicto}`,
    owner,
    accountId: ahorros,
    fecha: '2026-08-28T10:00:00.000-05:00',
    saldoReal: money(veredicto === 'cuadra' ? 1 : 955000, 'COP'),
    saldoCalculado: money(veredicto === 'cuadra' ? 1 : 1000000, 'COP'),
    diferencia: money(veredicto === 'cuadra' ? 0 : -45000, 'COP'),
    veredicto,
    fuente: 'bancolombia',
    detalle: 'Ahorros ****8901',
    creadoEn: '2026-08-28T10:00:00.000-05:00',
  });

  it('cierra la diferencia de una conciliación con un ajuste que la nombra', async () => {
    const d = await deps();
    await d.reconciliations.save(conciliacion('gasto-no-capturado'));

    const tx = await adjustToReconcile(d, { owner, reconciliationId: 'rec-gasto-no-capturado' });

    expect(await saldo(d, 'bancolombia:ahorros')).toBe(-45000n);
    expect(tx.descripcion).toMatch(/conciliación/i);
    expect(tx.descripcion).toContain('2026-08-28');
    expect(tx.descripcion).toContain('****8901');
    expect(tx.fecha).toBe('2026-08-28T10:00:00.000-05:00');
  });

  it('una conciliación que cuadra no genera ajuste', async () => {
    const d = await deps();
    await d.reconciliations.save(conciliacion('cuadra'));
    await expect(adjustToReconcile(d, { owner, reconciliationId: 'rec-cuadra' })).rejects.toThrow(
      /cuadra/,
    );
  });

  it('falla con un id desconocido', async () => {
    const d = await deps();
    await expect(adjustToReconcile(d, { owner, reconciliationId: 'nada' })).rejects.toThrow(/nada/);
  });
});
