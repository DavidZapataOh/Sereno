import type { CurrencyCode } from '@/domain/money/currency';

/**
 * Una tasa de cambio entre dos monedas.
 *
 * El valor va como **entero con su escala**, no como decimal: 3.202,79 pesos
 * por dólar es `320279` con escala 2. Un `number` aquí introduce un error que
 * después se multiplica por el saldo entero.
 *
 * `origen` y `momento` no son adorno: dentro de un mes, el número solo no dice
 * nada, y sin ellos no se puede saber si una cifra vieja se quedó pegada.
 */
export interface Rate {
  desde: CurrencyCode;
  hacia: CurrencyCode;
  valor: bigint;
  escala: number;
  /** Quién lo dijo: «TRM oficial», «Binance», «aproximado». */
  origen: string;
  /** Cuándo rige. ISO 8601 con zona. */
  momento: string;
}

export function rate(input: Rate): Rate {
  if (input.valor <= 0n) throw new Error('Una tasa tiene que ser positiva');
  if (input.escala < 0 || !Number.isInteger(input.escala)) {
    throw new Error('La escala de una tasa es un entero no negativo');
  }
  if (input.desde === input.hacia) {
    throw new Error('Una tasa entre una moneda y ella misma no significa nada');
  }
  if (input.origen.trim().length === 0) {
    throw new Error('Una tasa sin origen no vale: dentro de un mes nadie sabrá de dónde salió');
  }
  return input;
}
