import { MESES_MINIMOS, type Metrica } from '@/domain/metrics/behavior';

export interface Espejo {
  /** La frase, ya escrita. Habla de quien la lee, no de un número suelto. */
  frase: string;
  /** De qué métrica sale, para poder ir a mirarla. */
  clave: string;
}

/**
 * Las frases, en una lista cerrada.
 *
 * **Ninguna juzga.** «Gastas más los viernes» dice algo de quien lo lee;
 * «gastas demasiado los viernes» lo evalúa, y una app de dinero que evalúa se
 * cierra y no se vuelve a abrir. La diferencia es una palabra, y por eso las
 * frases están aquí y no dispersas: se leen todas juntas cuando se añade una.
 *
 * «Gastaste 620.000» es un informe. «Eres de los que aguanta cuatro meses sin
 * ingresos» es un espejo: dice algo sobre la persona, y eso es lo que se
 * recuerda.
 */
const FRASES: Record<string, (valor: number) => string | null> = {
  'antiguedad-del-dinero': (dias) =>
    dias >= 30
      ? `La plata que gastas hoy lleva ${String(Math.round(dias))} días contigo`
      : `Gastas la plata a los ${String(Math.round(dias))} días de que llega`,

  'tasa-de-ahorro': (pct) =>
    pct <= 0
      ? 'Estos meses gastas más de lo que entra'
      : `De cada cien pesos que entran, se te quedan ${String(Math.round(pct))}`,

  'meses-de-colchon': (meses) =>
    meses < 1
      ? 'Con lo que tienes aguantarías menos de un mes sin ingresos'
      : `Con lo que tienes aguantarías ${String(Math.round(meses))} meses sin ingresos`,

  'deuda-sobre-ingreso': (veces) =>
    veces <= 0
      ? 'No debes nada'
      : `Lo que debes equivale a ${String(Math.round(veces * 10) / 10)} meses de lo que ganas`,
};

/**
 * La frase de hoy, si hay alguna que se sostenga.
 *
 * Dos reglas la separan de la charlatanería:
 *
 * 1. **Solo si el dato aguanta.** Las mismas exigencias de meses mínimos que ya
 *    tienen las métricas: sin historia suficiente, no hay frase. Es preferible
 *    callar que decir algo que suena a verdad y no lo es.
 * 2. **No se repite la de ayer.** Una frase que sale todos los días deja de
 *    leerse a la semana. `evitar` es la de la última vez.
 */
export function espejoDe(
  metricas: readonly Metrica[],
  evitar: string | null = null,
): Espejo | null {
  const candidatas = metricas
    .filter((metrica) => metrica.meses >= MESES_MINIMOS)
    .filter((metrica) => metrica.clave !== evitar)
    .flatMap((metrica) => {
      const frase = FRASES[metrica.clave]?.(metrica.valor);
      return frase === null || frase === undefined ? [] : [{ frase, clave: metrica.clave }];
    });

  return candidatas[0] ?? null;
}

/** Las claves que saben decirse como frase. Sirve para probar la lista entera. */
export const CLAVES_CON_FRASE = Object.keys(FRASES);
