import type { Observability } from '@/domain/observability/port';
import { createConsoleObservability } from './console-logger';

/**
 * Instancia única de observabilidad de la aplicación.
 *
 * Hoy escribe a consola. Cuando el proyecto tenga development build, aquí se
 * selecciona el adaptador de Sentry sin tocar ningún llamador.
 */
export const observability: Observability = createConsoleObservability();

export type { Observability } from '@/domain/observability/port';
