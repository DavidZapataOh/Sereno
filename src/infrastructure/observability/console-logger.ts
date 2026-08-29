/* eslint-disable no-console -- este adaptador es el único punto autorizado a usar la consola */
import type { LogLevel, Observability } from '@/domain/observability/port';
import { redact } from '@/domain/observability/redact';

/**
 * Resuelve el escritor en el momento de escribir, no al cargar el módulo.
 *
 * Guardar las referencias de `console` al inicio las congela: cualquier
 * reemplazo posterior —un espía en pruebas, un interceptor en desarrollo— no
 * tendría efecto, y la salida escaparía por el canal original sin que nadie
 * lo note.
 */
function writerFor(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case 'debug':
      return (...args) => {
        console.debug(...args);
      };
    case 'info':
      return (...args) => {
        console.info(...args);
      };
    case 'warn':
      return (...args) => {
        console.warn(...args);
      };
    case 'error':
      return (...args) => {
        console.error(...args);
      };
  }
}

/**
 * Adaptador de desarrollo.
 *
 * Aplica la misma redacción que el adaptador de producción: los registros del
 * dispositivo también son accesibles, y acostumbrarse a ver datos crudos en
 * desarrollo lleva a filtrarlos en producción.
 */
export function createConsoleObservability(): Observability {
  const write = (level: LogLevel, message: string, context?: unknown): void => {
    const safeContext = context === undefined ? '' : JSON.stringify(redact(context));
    writerFor(level)(`[${level}] ${redact(message) as string}`, safeContext);
  };

  return {
    log: write,
    captureError: (error, context) => {
      // `redact` sobre un Error devuelve name, message y stack ya saneados.
      write('error', error.message, { error: redact(error), context });
    },
  };
}
