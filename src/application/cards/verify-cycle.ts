import type { BillingCycle } from '@/domain/cards/billing-cycle';
import type { Money } from '@/domain/money/money';
import { subtract } from '@/domain/money/money';

import type { CycleStatement } from './cycle-statement';

/**
 * - `sin-pago`: el ciclo todavía no vence. No hay nada que reprochar.
 * - `al-dia`: se pagó lo que se compró.
 * - `financiado`: se pagó menos. **No es un error**: es deuda a plazos.
 * - `adelantado`: se pagó más de lo comprado en el ciclo, abonando a deuda vieja.
 */
export type VeredictoCiclo = 'sin-pago' | 'al-dia' | 'financiado' | 'adelantado';

export interface CycleCheck {
  ciclo: BillingCycle;
  comprado: Money;
  pagado: Money;
  /** Lo comprado menos lo pagado. Positivo si queda debiendo. */
  diferencia: Money;
  veredicto: VeredictoCiclo;
}

/**
 * Unos pesos de diferencia son redondeo, no financiación.
 *
 * Sin este margen, cada ciclo diría «financiado» por cien pesos y la palabra
 * dejaría de significar nada. Un aviso que salta con lo normal enseña a
 * ignorar los avisos (sprint 06, hallazgo 13).
 */
const MARGEN = 1000n;

/**
 * Compara lo comprado en un ciclo con lo que se pagó.
 *
 * **Que no coincida no es un error.** Con compras a cuotas se paga menos de lo
 * comprado, y la diferencia es deuda que sigue viva: eso es lo que hay que
 * decir, no una alarma. Lo dijo David al descartar el plan 02.
 */
export function verifyCycle(extracto: CycleStatement, hoy: string): CycleCheck {
  const { ciclo, compras, pagos } = extracto;
  const diferencia = subtract(compras, pagos);

  const veredicto = ((): VeredictoCiclo => {
    // Antes del día de pago no se puede juzgar nada.
    if (pagos.amount === 0n && hoy.slice(0, 10) <= ciclo.pago) return 'sin-pago';
    if (diferencia.amount > MARGEN) return 'financiado';
    if (diferencia.amount < -MARGEN) return 'adelantado';
    return 'al-dia';
  })();

  return { ciclo, comprado: compras, pagado: pagos, diferencia, veredicto };
}
