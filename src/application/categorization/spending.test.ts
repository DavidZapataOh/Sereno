import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { categorizationDeps } from '@/test/fakes/categorization-deps';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import { ensureDefaultCategories } from './ensure-default-categories';
import { monthRange, spendingByCategory } from './spending';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');

describe('monthRange', () => {
  it('da el mes de Colombia entero, con zona explícita', () => {
    // 23:30 UTC del 31 de agosto son las 18:30 del 31 en Colombia: agosto.
    expect(monthRange('2026-08-31T23:30:00.000Z')).toEqual({
      desde: '2026-08-01T00:00:00.000-05:00',
      hasta: '2026-08-31T23:59:59.999-05:00',
    });
    // 03:00 UTC del 1 de septiembre siguen siendo el 31 de agosto en Colombia.
    expect(monthRange('2026-09-01T03:00:00.000Z').desde).toBe('2026-08-01T00:00:00.000-05:00');
    expect(monthRange('2026-02-10T12:00:00.000-05:00').hasta).toBe('2026-02-28T23:59:59.999-05:00');
  });
});

describe('spendingByCategory', () => {
  it('suma lo del periodo por categoría, ordena de mayor a menor y cuenta lo pendiente', async () => {
    const d = categorizationDeps();
    await ensureSystemAccounts(d.accounts, owner);
    await ensureDefaultCategories(d, owner);
    await d.accounts.save(
      createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
    );
    let n = 0;
    const gasto = (fecha: string, contraparte: string, monto: number) => {
      n += 1;
      return d.transactions.save(
        createTransaction({
          id: transactionId(`bancolombia:G${String(n)}`),
          owner,
          fecha,
          descripcion: 'x',
          origen: { fuente: 'bancolombia', referencia: `G${String(n)}` },
          postings: [
            { accountId: ahorros, amount: money(-monto, 'COP') },
            { accountId: accountId(contraparte), amount: money(monto, 'COP') },
          ],
        }),
      );
    };
    await gasto('2026-08-05T00:00:00.000-05:00', 'categoria:mercado', 100000);
    await gasto('2026-08-20T00:00:00.000-05:00', 'categoria:mercado', 50000);
    await gasto('2026-08-31T23:00:00.000-05:00', 'categoria:hogar', 200000);
    await gasto('2026-07-31T23:59:00.000-05:00', 'categoria:mercado', 999999); // mes pasado
    await gasto('2026-08-10T00:00:00.000-05:00', 'sistema:gastos-sin-clasificar', 7000);

    const r = await spendingByCategory(d, {
      owner,
      kind: 'gasto',
      ...monthRange('2026-08-15T12:00:00.000-05:00'),
    });
    expect(r.items.map((i) => [i.categoria.id, i.total.amount])).toEqual([
      [categoryAccountId('hogar'), 200000n],
      [categoryAccountId('mercado'), 150000n],
    ]);
    expect(r.sinClasificar.amount).toBe(7000n);
    expect(r.total.amount).toBe(350000n);
  });

  it('sin movimientos, todo en cero y sin categorías', async () => {
    const d = categorizationDeps();
    await ensureSystemAccounts(d.accounts, owner);
    await ensureDefaultCategories(d, owner);
    const r = await spendingByCategory(d, {
      owner,
      kind: 'ingreso',
      ...monthRange('2026-08-15T12:00:00.000-05:00'),
    });
    expect(r).toEqual({ items: [], sinClasificar: money(0, 'COP'), total: money(0, 'COP') });
    expect(systemAccountId('ingresos-sin-clasificar')).toBe('sistema:ingresos-sin-clasificar');
  });
});
