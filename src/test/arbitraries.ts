import { date as dateArbitrary, integer } from 'fast-check';

/**
 * Montos positivos en pesos, hasta mil millones.
 * El tope evita generar cifras absurdas que solo prueban desbordamiento.
 */
export const positiveAmount = integer({ min: 1, max: 1_000_000_000 });

/** Fechas ISO 8601 en UTC, entre 2020 y 2030. */
export const isoDate = dateArbitrary({
  min: new Date('2020-01-01T00:00:00.000Z'),
  max: new Date('2030-12-31T23:59:59.999Z'),
}).map((valor) => valor.toISOString());
