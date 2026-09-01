import { subtract, sum, type Money } from '@/domain/money/money';

import type { Envelope } from './envelope';

export interface Reparto {
  ingresoDelMes: Money;
  asignado: Money;
  /** Lo que entra menos lo asignado. Negativo = se asignó de más. */
  sinAsignar: Money;
  /** El invariante del método: ningún peso sin destino. */
  completo: boolean;
}

/**
 * Cómo va el reparto del mes.
 *
 * David eligió sobres clásicos sabiendo que exigen una sesión mensual, así que
 * «completo» es un estado real que hay que poder alcanzar y enseñar.
 *
 * **Asignar de más no es un error**: es gastar ahorro, y es una decisión. Pero
 * tiene que verse, porque es exactamente lo que hunde un mes.
 */
export function repartoDe(ingresoDelMes: Money, sobres: readonly Envelope[]): Reparto {
  const asignado = sum(
    sobres.map((s) => s.asignado),
    ingresoDelMes.currency,
  );
  const sinAsignar = subtract(ingresoDelMes, asignado);
  return {
    ingresoDelMes,
    asignado,
    sinAsignar,
    completo: sinAsignar.amount === 0n && ingresoDelMes.amount > 0n,
  };
}
