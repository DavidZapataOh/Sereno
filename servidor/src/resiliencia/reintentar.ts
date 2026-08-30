/** Códigos y textos que significan «vuelve a intentarlo dentro de un rato». */
const TRANSITORIOS = [
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ESOCKETTIMEDOUT',
];
const TEXTOS_TRANSITORIOS = /\b(429|500|502|503|504)\b|too many requests|timeout|temporarily/i;

export function esTransitorio(error: unknown): boolean {
  const codigo = (error as { code?: unknown } | null)?.code;
  if (typeof codigo === 'string' && TRANSITORIOS.includes(codigo)) return true;
  return error instanceof Error && TEXTOS_TRANSITORIOS.test(error.message);
}

/**
 * Cuánto esperar antes del intento siguiente.
 *
 * Exponencial con tope, y con jitter: sin él, todos los reintentos del mundo
 * caen a la vez sobre el servicio que acaba de levantarse. El jitter reparte
 * la espera entre la mitad y el total previsto.
 */
export function esperaPara(
  intento: number,
  base: number,
  tope: number,
  azar: () => number,
): number {
  const previsto = Math.min(base * 2 ** intento, tope);
  return Math.round(previsto * (0.5 + azar() * 0.5));
}

export interface OpcionesReintento {
  intentos: number;
  baseMs: number;
  topeMs: number;
  dormir?: (ms: number) => Promise<void>;
  azar?: () => number;
  alReintentar?: (intento: number, error: unknown, esperaMs: number) => void;
}

const dormirDeVerdad = (ms: number): Promise<void> =>
  new Promise((listo) => {
    setTimeout(listo, ms);
  });

/**
 * Reintenta lo que mejora esperando, y solo eso.
 *
 * Un error permanente sube al primer intento: insistir con una credencial
 * revocada no la arregla, y sí puede conseguir que bloqueen la cuenta.
 */
export async function reintentar<T>(fn: () => Promise<T>, opciones: OpcionesReintento): Promise<T> {
  const dormir = opciones.dormir ?? dormirDeVerdad;
  const azar = opciones.azar ?? Math.random;
  let ultimo: unknown;

  for (let intento = 0; intento < opciones.intentos; intento += 1) {
    try {
      return await fn();
    } catch (error) {
      ultimo = error;
      if (!esTransitorio(error)) throw error;
      if (intento === opciones.intentos - 1) break;
      const espera = esperaPara(intento, opciones.baseMs, opciones.topeMs, azar);
      opciones.alReintentar?.(intento + 1, error, espera);
      await dormir(espera);
    }
  }
  throw ultimo;
}
