import type { Money } from '@/domain/money/money';
import { cadena, tasaHasta } from '@/domain/rates/convert';
import type { Rate } from '@/domain/rates/rate';

export type Valoracion =
  | { estado: 'valorado'; enPesos: Money; tasa: Rate | null }
  | { estado: 'sin-valorar'; original: Money };

/**
 * Cuánto vale en pesos un saldo en cualquier moneda.
 *
 * Sin tasa, el saldo **no vale cero**: vale «no se pudo valorar». Sumarlo como
 * cero es la forma más silenciosa de que el patrimonio mienta, y se ve
 * perfectamente bien —la cifra sale, solo que le falta plata—.
 *
 * Devuelve también la tasa usada, para poder decir de cuándo es. «Tu
 * patrimonio son X pesos» sin procedencia es un número, no una respuesta.
 */
export function valorarEnCOP(saldo: Money, tasas: readonly Rate[]): Valoracion {
  if (saldo.currency === 'COP') {
    return { estado: 'valorado', enPesos: saldo, tasa: null };
  }
  const enPesos = cadena(saldo, tasas, 'COP');
  if (enPesos === null) return { estado: 'sin-valorar', original: saldo };

  return { estado: 'valorado', enPesos, tasa: tasaHasta(saldo.currency, 'COP', tasas) };
}
