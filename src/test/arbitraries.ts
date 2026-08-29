import { date as dateArbitrary, integer } from 'fast-check';

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
