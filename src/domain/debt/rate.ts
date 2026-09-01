import type { Tasa } from './debt';

const MESES = 12;

/**
 * La tasa mensual que corresponde a una tasa dada.
 *
 * **La conversión que casi todo el mundo hace mal es dividir entre doce.** Con
 * 24 % E.A. eso da 2,0 % mensual, y la buena es 1,809 %: la efectiva anual ya
 * incluye el interés compuesto, así que deshacerlo es una raíz doceava, no una
 * división. Sobre un saldo de diez millones la diferencia son unos 19.000 pesos
 * al mes, y con eso la fecha de salida se corre meses.
 *
 * Esto vive en una sola función a propósito. El día que esté mal, que esté mal
 * en un solo sitio.
 */
export function mensualDe(tasa: Tasa): number {
  if (tasa.tipo === 'MV') return tasa.valor;
  return Math.pow(1 + tasa.valor, 1 / MESES) - 1;
}

/** La efectiva anual que corresponde a una tasa dada. */
export function anualDe(tasa: Tasa): number {
  if (tasa.tipo === 'EA') return tasa.valor;
  return Math.pow(1 + tasa.valor, MESES) - 1;
}
