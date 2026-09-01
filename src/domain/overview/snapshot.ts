import type { OwnerId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';

/**
 * Cuánto valía el patrimonio un día, **con las tasas de ese día**.
 *
 * Lo que hace que la serie signifique algo. Si cada punto se recalculara con
 * las tasas de hoy, la línea del pasado cambiaría cada mañana y no mediría
 * nada: un dólar que sube haría parecer que uno ahorró en marzo. Por eso el
 * valor se guarda ya calculado, y `tasas` queda como constancia de con qué se
 * calculó.
 */
export interface Snapshot {
  owner: OwnerId;
  /** El día, en `YYYY-MM-DD` y hora de Colombia. Uno por día, no por instante. */
  dia: string;
  patrimonio: Money;
  /** Con qué se valoró: «TRM oficial × Binance», y de cuándo. */
  tasas: string;
  /** Cuándo se tomó. Dos arranques el mismo día dejan un solo punto. */
  tomadaEn: string;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export function snapshot(input: Snapshot): Snapshot {
  if (!DIA.test(input.dia)) throw new Error(`Un día se escribe YYYY-MM-DD, no "${input.dia}"`);
  if (input.patrimonio.currency !== 'COP') {
    // La serie compara días entre sí: en dos monedas no se puede comparar.
    throw new Error('La serie del patrimonio va en pesos');
  }
  return input;
}

/**
 * Los días que faltan entre dos instantáneas consecutivas.
 *
 * Sirve para no dibujar una línea recta sobre un hueco. Un día sin instantánea
 * **no es un cero**: un cero en la gráfica se lee como «se quedó sin nada», y
 * lo que pasó fue que la app no se abrió.
 */
export function hayHueco(anterior: Snapshot, siguiente: Snapshot): boolean {
  const unDia = 24 * 60 * 60 * 1000;
  return Date.parse(`${siguiente.dia}T00:00:00Z`) - Date.parse(`${anterior.dia}T00:00:00Z`) > unDia;
}
