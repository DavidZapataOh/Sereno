import type { OwnerId } from '@/domain/ledger/ids';
import { sum, type Money } from '@/domain/money/money';
import { ritmoDe, type Ritmo } from '@/domain/sinking/sinking-fund';

import { observedIncome } from '../income/observed-income';
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

  const { promedio: ingresoObservado } = await observedIncome(deps, { hasta: hoy, moneda });
  return {
    metas,
    aporteTotal,
    ingresoObservado,
    cabeEnElIngreso:
      ingresoObservado === null ? null : aporteTotal.amount <= ingresoObservado.amount,
  };
}
