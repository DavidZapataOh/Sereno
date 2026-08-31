import { daysBetween } from '@/domain/time/colombia';

/** Cada cuánto se repite un cobro. */
export type Cadence = 'quincenal' | 'mensual' | 'bimestral' | 'trimestral' | 'anual';

interface Periodo {
  cadencia: Cadence;
  dias: number;
  /** Cuánto se puede desviar cada intervalo sin dejar de ser este periodo. */
  tolerancia: number;
}

/**
 * Los periodos que existen en la vida real, con lo que se les permite variar.
 *
 * Un cobro mensual no cae el mismo día: cae el 5, el 4, el 6, según fines de
 * semana y festivos. La tolerancia es lo que hace que eso siga siendo mensual;
 * apretarla más deja de detectar suscripciones de verdad, y aflojarla convierte
 * tres compras cualesquiera en una suscripción.
 *
 * Van de menor a mayor: con un intervalo de 30 días encajan «mensual» y nadie
 * más, pero con 60 encajarían bimestral y —si la tolerancia fuera mayor— dos
 * meses seguidos mal medidos. Se prueba en orden y gana el primero.
 */
const PERIODOS: readonly Periodo[] = [
  { cadencia: 'quincenal', dias: 15, tolerancia: 4 },
  { cadencia: 'mensual', dias: 30, tolerancia: 4 },
  { cadencia: 'bimestral', dias: 61, tolerancia: 10 },
  { cadencia: 'trimestral', dias: 91, tolerancia: 10 },
  { cadencia: 'anual', dias: 365, tolerancia: 20 },
];

/**
 * Mínimo de fechas para hablar de un periodo.
 *
 * Con dos puntos **cualquier** periodo encaja: la distancia entre ellos es
 * exactamente el periodo, por definición. De ahí salen los avisos falsos que
 * enseñan a ignorar los avisos.
 */
const MINIMO_FECHAS = 3;

export interface Cadencia {
  cadencia: Cadence;
  /** 1 si los intervalos son clavados; 0 en el límite de la tolerancia. */
  confianza: number;
}

/**
 * Qué periodo siguen estas fechas, si siguen alguno.
 *
 * Pide que **todos** los intervalos encajen, no el promedio: una serie de
 * enero, febrero y agosto tiene un promedio mensual-ish y no es una
 * suscripción.
 */
export function cadenciaDe(fechas: readonly string[]): Cadencia | null {
  if (fechas.length < MINIMO_FECHAS) return null;

  const ordenadas = [...fechas].sort();
  const intervalos: number[] = [];
  for (let i = 1; i < ordenadas.length; i += 1) {
    intervalos.push(daysBetween(ordenadas[i - 1] ?? '', ordenadas[i] ?? ''));
  }
  if (intervalos.some((d) => d === 0)) return null;

  for (const periodo of PERIODOS) {
    const desvios = intervalos.map((d) => Math.abs(d - periodo.dias));
    if (desvios.some((d) => d > periodo.tolerancia)) continue;
    const peor = Math.max(...desvios);
    return { cadencia: periodo.cadencia, confianza: 1 - peor / periodo.tolerancia };
  }
  return null;
}

/** Cuántos días dura un periodo. Para saber cuándo toca el siguiente cobro. */
export function diasDe(cadencia: Cadence): number {
  const periodo = PERIODOS.find((p) => p.cadencia === cadencia);
  if (periodo === undefined) throw new Error(`Cadencia desconocida: ${cadencia}`);
  return periodo.dias;
}
