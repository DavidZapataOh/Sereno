import { categoryAccountId, DEFAULT_CATEGORIES } from '@/domain/categorization/taxonomy';
import type { OwnerId } from '@/domain/ledger/ids';
import { subtract, sum, zero, type Money } from '@/domain/money/money';
import { ritmoDe, type Ritmo } from '@/domain/sinking/sinking-fund';

import { listFunds, type FundDeps, type FundState } from '../sinking/manage-funds';

export interface GoalDeps extends FundDeps {
  /** Desde cuándo se mide el ritmo. La primera corrida de la app basta. */
  inicio: string;
}

export interface GoalState extends FundState {
  ritmo: Ritmo;
}

export interface GoalsSummary {
  metas: GoalState[];
  /** Lo que hay que apartar al mes entre todas. */
  aporteTotal: Money;
  /** El ingreso mensual que el ledger observa. `null` sin historia. */
  ingresoObservado: Money | null;
  /**
   * `false` cuando el aporte total no cabe en el ingreso observado. Decir
   * «aparta cuatro millones» con un ingreso de tres es burlarse.
   */
  cabeEnElIngreso: boolean | null;
}

/** Cuántos meses atrás se mira el ingreso. */
const VENTANA = 3;

/**
 * Las metas con su progreso, y si el plan cabe en lo que se gana.
 *
 * Reutiliza `listFunds`: **una meta es un fondo con otra intención**, y el
 * cálculo de cuánto apartar es el mismo. Lo que añade es el ritmo —adelantado o
 * atrasado— y la comparación contra el ingreso real.
 */
export async function goalProgress(deps: GoalDeps, owner: OwnerId): Promise<GoalsSummary> {
  const hoy = deps.clock().slice(0, 10);
  const todos = await listFunds(deps, owner);
  const metas = todos
    .filter((f) => f.fondo.tipo === 'meta')
    .map((f) => ({ ...f, ritmo: ritmoDe(f.fondo, f.apartado, hoy, deps.inicio) }));

  const moneda = metas[0]?.fondo.objetivo.currency ?? 'COP';
  const aporteTotal = sum(
    metas.map((m) => m.aporteDeEsteMes),
    moneda,
  );

  const ingresoObservado = await ingresoMensual(deps, hoy, moneda);
  return {
    metas,
    aporteTotal,
    ingresoObservado,
    cabeEnElIngreso:
      ingresoObservado === null ? null : aporteTotal.amount <= ingresoObservado.amount,
  };
}

/**
 * El ingreso mensual que el ledger observa.
 *
 * Lo declarado es lo que uno cree ganar; el ledger sabe lo que entró. `null`
 * cuando no hay historia: devolver cero diría «no ganas nada».
 */
async function ingresoMensual(
  deps: GoalDeps,
  hoy: string,
  moneda: Money['currency'],
): Promise<Money | null> {
  const slugs = DEFAULT_CATEGORIES.filter((c) => c.kind === 'ingreso').map((c) => c.slug);
  const meses: Money[] = [];

  let cursor = mesAnterior(hoy.slice(0, 7));
  for (let i = 0; i < VENTANA; i += 1) {
    let delMes = zero(moneda);
    for (const slug of slugs) {
      const id = categoryAccountId(slug);
      if ((await deps.accounts.findById(id)) === null) continue;
      const cierre = await deps.accounts.balanceOf(id, { hasta: finDe(cursor) });
      const inicio = await deps.accounts.balanceOf(id, { hasta: finDe(mesAnterior(cursor)) });
      // El ingreso llega como crédito: negativo sobre la cuenta de ingreso.
      const delSlug = subtract(inicio, cierre);
      delMes = { amount: delMes.amount + delSlug.amount, currency: moneda };
    }
    if (delMes.amount !== 0n) meses.push(delMes);
    cursor = mesAnterior(cursor);
  }

  if (meses.length === 0) return null;
  return { amount: sum(meses, moneda).amount / BigInt(meses.length), currency: moneda };
}

function mesAnterior(mes: string): string {
  const [anio = 1970, m = 1] = mes.split('-').map(Number);
  const total = (anio - 1) * 12 + (m - 1) - 1;
  return `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function finDe(mes: string): string {
  const [anio = 1970, m = 1] = mes.split('-').map(Number);
  const total = (anio - 1) * 12 + m;
  const siguiente = `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
  return `${siguiente}-01T00:00:00.000-05:00`;
}
