import type { TransactionId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';

import { anomalyId, createAnomaly, type Anomaly } from './anomaly';

/**
 * Cuántas veces la mediana tiene que superar un cobro para ser raro.
 *
 * Explícito y alto a propósito. Bajarlo «para que detecte más» es la forma
 * segura de enseñar a ignorar la pantalla: la primera alerta falsa hace que no
 * se lean las demás.
 */
export const VECES_PARA_SER_RARO = 4;

/** Con menos historia que esto, cualquier cosa parece inusual. */
export const COBROS_MINIMOS = 6;

export interface CobroObservado {
  transaccion: TransactionId;
  monto: Money;
  /** El comercio ya normalizado (sprint 05), no la descripción cruda. */
  comercio: string;
}

/**
 * Un cobro muy por encima de lo habitual **en su categoría**.
 *
 * Se compara contra la **mediana, no la media**: una compra grande arrastra la
 * media hacia arriba y a partir de ahí deja de detectar las siguientes, que es
 * justo cuando haría falta. La mediana no se mueve.
 */
export function montoInusual(
  cobro: CobroObservado,
  historial: readonly Money[],
  veces = VECES_PARA_SER_RARO,
): Anomaly | null {
  if (historial.length < COBROS_MINIMOS) return null;

  const mediana = medianaDe(historial);
  if (mediana <= 0n) return null;

  const cuantas = Number((cobro.monto.amount * 100n) / mediana) / 100;
  if (cuantas < veces) return null;

  return createAnomaly({
    id: anomalyId('monto-inusual', cobro.transaccion),
    tipo: 'monto-inusual',
    transaccion: cobro.transaccion,
    explicacion: `Este cobro es ${cuantas.toFixed(1)} veces lo que sueles gastar aquí`,
    comparadoCon: `la mediana de ${String(historial.length)} cobros de la misma categoría`,
    // Más lejos de la mediana, más seguro; con tope, porque nunca es certeza.
    confianza: Math.min(0.95, 0.5 + (cuantas - veces) / 20),
  });
}

/** La mediana de una lista de montos. */
export function medianaDe(montos: readonly Money[]): bigint {
  if (montos.length === 0) return 0n;
  const ordenados = [...montos].map((m) => m.amount).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const medio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return ordenados[medio] ?? 0n;
  return ((ordenados[medio - 1] ?? 0n) + (ordenados[medio] ?? 0n)) / 2n;
}
