import type { Category } from '@/domain/categorization/category';
import type { OwnerId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { absolute, add, zero, type Money } from '@/domain/money/money';
import { calendarDay, COLOMBIA_UTC_OFFSET } from '@/domain/time/colombia';

import { listCategories } from './ensure-default-categories';
import type { CategorizationDeps } from './types';

export interface CategorySpending {
  categoria: Category;
  total: Money;
}

export interface SpendingReport {
  /** Solo las categorías con movimiento en el periodo, de mayor a menor. */
  items: CategorySpending[];
  sinClasificar: Money;
  /** Suma de las categorías, sin lo pendiente. */
  total: Money;
}

const diasDelMes = (anio: number, mes: number): number =>
  new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** El mes de Colombia al que pertenece `now`, del primer al último instante, con zona explícita. */
export function monthRange(now: string): { desde: string; hasta: string } {
  const [anio, mes] = calendarDay(now).split('-').map(Number);
  const a = anio ?? 1970;
  const m = mes ?? 1;
  const mm = String(m).padStart(2, '0');
  return {
    desde: `${String(a)}-${mm}-01T00:00:00.000${COLOMBIA_UTC_OFFSET}`,
    hasta: `${String(a)}-${mm}-${String(diasDelMes(a, m)).padStart(2, '0')}T23:59:59.999${COLOMBIA_UTC_OFFSET}`,
  };
}

/** El instante justo anterior a `desde`, en la misma zona. */
function antesDe(desde: string): string {
  const [dia] = desde.split('T');
  const [anio, mes, d] = (dia ?? '').split('-').map(Number);
  const fecha = new Date(Date.UTC(anio ?? 1970, (mes ?? 1) - 1, (d ?? 1) - 1));
  return `${fecha.toISOString().slice(0, 10)}T23:59:59.999${COLOMBIA_UTC_OFFSET}`;
}

/**
 * Cuánto se fue a cada categoría entre dos fechas: el saldo de la cuenta de
 * la categoría hasta `hasta` menos el saldo hasta justo antes de `desde`.
 * El mismo `balanceOf` que calcula todo lo demás (ADR 0005).
 */
export async function spendingByCategory(
  deps: Pick<CategorizationDeps, 'accounts' | 'categories'>,
  input: { owner: OwnerId; desde: string; hasta: string; kind: 'gasto' | 'ingreso' },
): Promise<SpendingReport> {
  const limite = antesDe(input.desde);
  const entre = async (id: Category['id']): Promise<Money> => {
    const [hasta, antes] = await Promise.all([
      deps.accounts.balanceOf(id, { hasta: input.hasta }),
      deps.accounts.balanceOf(id, { hasta: limite }),
    ]);
    return absolute({ amount: hasta.amount - antes.amount, currency: hasta.currency });
  };

  const categorias = (await listCategories(deps, input.owner, { incluirArchivadas: true })).filter(
    (c) => c.kind === input.kind,
  );
  const items: CategorySpending[] = [];
  let total = zero('COP');
  for (const categoria of categorias) {
    const monto = await entre(categoria.id);
    if (monto.amount === 0n) continue;
    items.push({ categoria, total: monto });
    total = add(total, monto);
  }
  items.sort((a, b) =>
    a.total.amount < b.total.amount ? 1 : a.total.amount > b.total.amount ? -1 : 0,
  );

  const pendiente = systemAccountId(
    input.kind === 'gasto' ? 'gastos-sin-clasificar' : 'ingresos-sin-clasificar',
  );
  const sinClasificar =
    (await deps.accounts.findById(pendiente)) === null ? zero('COP') : await entre(pendiente);
  return { items, sinClasificar, total };
}
