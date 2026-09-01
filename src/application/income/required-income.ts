import { calcular, type IngresoRequerido } from '@/domain/income/required-income';
import type { OwnerId } from '@/domain/ledger/ids';
import { add, subtract, zero, type Money } from '@/domain/money/money';
import { calendarDay } from '@/domain/time/colombia';

import { paymentCalendar } from '../calendar/payment-calendar';
import type { GoalDeps } from '../goals/goal-progress';

import { observedIncome } from './observed-income';
import { listFunds } from '../sinking/manage-funds';
import type { CashFlowDeps } from '../cashflow/cash-flow';

export interface RequiredIncomeDeps extends CashFlowDeps, GoalDeps {}

export interface ResumenIngreso {
  requerido: IngresoRequerido;
  /** Lo que el ledger observa que entra. `null` sin historia. */
  observado: Money | null;
  /** Sobre cuántos meses se observó. Un promedio de un mes no es un promedio. */
  meses: number;
  /** Lo que falta para sostener el ritmo actual. Negativo = sobra. */
  brecha: Money | null;
}

/**
 * Cuánto hay que generar al mes, comparado con lo que de verdad entra.
 *
 * **Se compara contra el ingreso observado**, no contra uno declarado: lo
 * declarado es lo que uno cree ganar, y el ledger sabe lo que entró.
 *
 * Cuando no alcanza, se dice **sin regañar**: quien mira esta pantalla ya sabe
 * que va apretado (principio 3).
 */
export async function requiredIncome(
  deps: RequiredIncomeDeps,
  input: { owner: OwnerId },
): Promise<ResumenIngreso> {
  const hoy = calendarDay(deps.clock());
  const moneda = 'COP' as const;

  // --- Comprometido: lo que vence este mes con monto conocido.
  const obligaciones = await paymentCalendar(deps, {
    owner: input.owner,
    desde: hoy.slice(0, 8) + '01',
    hasta: hoy.slice(0, 8) + '28',
  });
  let comprometido = zero(moneda);
  for (const o of obligaciones) {
    if (o.monto !== null) comprometido = add(comprometido, o.monto);
  }

  // --- Aportes: fondos y metas, que son decisiones ya tomadas.
  const fondos = await listFunds(deps, input.owner);
  const aportes = fondos.reduce<Money>((acc, f) => add(acc, f.aporteDeEsteMes), zero(moneda));

  // --- El gasto habitual todavía no se estima; se declara así en el plan 04 y
  // aquí se mantiene por lo mismo: una media mal hecha contamina las tres
  // cifras, y el sitio ya está separado para cuando haya con qué calcularla.
  const habitualNoComprometido = zero(moneda);

  const observado = await observedIncome(deps, { hasta: hoy, moneda });
  const requerido = calcular({ comprometido, habitualNoComprometido, aportes });

  return {
    requerido,
    observado: observado.promedio,
    meses: observado.meses,
    brecha: observado.promedio === null ? null : subtract(requerido.sostener, observado.promedio),
  };
}
