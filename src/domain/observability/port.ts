import { redact } from './redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: unknown;
}

/**
 * Puerto de observabilidad.
 *
 * Ninguna capa importa Sentry ni ninguna otra herramienta directamente: se
 * programa contra esta interfaz. Cambiar de proveedor no toca código de negocio.
 */
export interface Observability {
  log: (level: LogLevel, message: string, context?: unknown) => void;
  captureError: (error: Error, context?: unknown) => void;
}

export interface MemoryObservability extends Observability {
  entries: LogEntry[];
}

/**
 * Implementación en memoria para pruebas: permite verificar qué se registró sin
 * emitir nada a ningún lado.
 */
export function createMemoryObservability(): MemoryObservability {
  const entries: LogEntry[] = [];

  const push = (level: LogLevel, message: string, context?: unknown): void => {
    entries.push({
      level,
      message: redact(message) as string,
      context: context === undefined ? undefined : redact(context),
    });
  };

  return {
    entries,
    log: push,
    captureError: (error, context) => {
      push('error', error.message, context);
    },
  };
}
