import { array, bigInt, date as dateArbitrary, integer } from 'fast-check';

import { accountId } from '@/domain/ledger/ids';
import type { Posting } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

/**
 * Montos positivos en pesos, hasta mil millones.
 * El tope evita generar cifras absurdas que solo prueban desbordamiento.
 */
export const positiveAmount = integer({ min: 1, max: 1_000_000_000 });

/**
 * Fechas ISO 8601 en UTC, entre 2020 y 2030.
 *
 * `noInvalidDate` es obligatorio: por defecto el generador produce `Invalid
 * Date` como caso límite, y `toISOString()` lanza sobre ella. Sin esta opción
 * el conjunto de pruebas falla de forma aleatoria, que es peor que fallar
 * siempre.
 */
export const isoDate = dateArbitrary({
  min: new Date('2020-01-01T00:00:00.000Z'),
  max: new Date('2030-12-31T23:59:59.999Z'),
  noInvalidDate: true,
}).map((valor) => valor.toISOString());

/**
 * Apuntes que cuadran: n montos libres y uno final que compensa.
 *
 * Es el generador de la invariante de doble partida. Lo usan las propiedades
 * del ledger, del códec y de los ajustes manuales.
 */
export const apuntesQueCuadran = array(bigInt({ min: -100_000_000n, max: 100_000_000n }), {
  minLength: 1,
  maxLength: 8,
}).map((montos): Posting[] => {
  const compensacion = -montos.reduce((acc, m) => acc + m, 0n);
  return [...montos, compensacion].map((amount, indice) => ({
    accountId: accountId(`cuenta-${String(indice)}`),
    amount: money(amount, 'COP'),
  }));
});
