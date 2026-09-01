import { add, zero, type Money } from '@/domain/money/money';

/**
 * Cuánto hay que generar al mes. **Tres cifras, no una.**
 *
 * Una sola escondería cuál se está mirando, y son preguntas distintas: no es lo
 * mismo «cuánto necesito para no hundirme» que «cuánto para vivir como vivo» o
 * «cuánto para llegar a donde quiero».
 */
export interface IngresoRequerido {
  /** Solo lo comprometido: cuotas, tarjetas, suscripciones. Para no hundirse. */
  minimo: Money;
  /** Lo anterior más el gasto habitual. Para seguir viviendo igual. */
  sostener: Money;
  /** Lo anterior más los aportes a fondos y metas. Para llegar a donde se quiere. */
  conMetas: Money;
}

export interface Entradas {
  /** Obligaciones con fecha y monto. */
  comprometido: Money;
  /**
   * El gasto habitual observado, **ya sin lo que también es comprometido**.
   * Sumar una suscripción dos veces inflaría el número justo en la dirección
   * que desanima.
   */
  habitualNoComprometido: Money;
  /** Lo que se aparta cada mes para fondos y metas. */
  aportes: Money;
}

/**
 * Las tres cifras.
 *
 * Crecen en orden por construcción: cada una añade a la anterior. Si alguna
 * rompiera el orden, algo se estaría contando dos veces.
 */
export function calcular(entradas: Entradas): IngresoRequerido {
  const minimo = entradas.comprometido;
  const sostener = add(minimo, entradas.habitualNoComprometido);
  return { minimo, sostener, conMetas: add(sostener, entradas.aportes) };
}

/** Nada declarado todavía: tres ceros, no un error. */
export function sinDatos(moneda: Money['currency']): IngresoRequerido {
  const cero = zero(moneda);
  return { minimo: cero, sostener: cero, conMetas: cero };
}
