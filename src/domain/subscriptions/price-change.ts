import type { Money } from '@/domain/money/money';

import type { Subscription } from './subscription';

export interface PriceChange {
  anterior: Money;
  nuevo: Money;
  /** Positivo si subió, negativo si bajó. */
  porcentaje: number;
}

/**
 * Cuánto varía un cobro sin que sea un cambio de precio.
 *
 * Entre dos cobros de la misma suscripción puede haber unos pesos de
 * diferencia: impuestos, redondeo, un tipo de cambio. Avisar de eso todos los
 * meses es la forma más rápida de que el usuario deje de leer los avisos
 * (sprint 06, hallazgo 13).
 */
const UMBRAL = 0.02;

/**
 * Si el precio cambió respecto al cobro anterior.
 *
 * Compara los **dos últimos** cobros, no el primero con el último: lo que
 * interesa es «acaba de subir», no «cuánto ha subido desde 2024».
 */
export function priceChangeOf(sub: Subscription): PriceChange | null {
  const nuevo = sub.historial.at(-1);
  const anterior = sub.historial.at(-2);
  if (nuevo === undefined || anterior === undefined) return null;
  if (anterior.amount === 0n) return null;

  const variacion = Number(nuevo.amount - anterior.amount) / Number(anterior.amount);
  // `<=`: justo en el umbral todavía no se avisa. En la frontera conviene
  // callar, no avisar: un aviso de más cuesta más que uno de menos.
  if (Math.abs(variacion) <= UMBRAL) return null;

  return { anterior, nuevo, porcentaje: variacion * 100 };
}
