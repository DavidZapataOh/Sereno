import { CAPTURE_PROTOCOL_VERSION } from './protocol';
import type { Capture } from './reassembler';

/**
 * Serializa las capturas de la sesión para analizarlas fuera de la aplicación.
 *
 * El resultado contiene datos bancarios reales. La advertencia va incrustada en
 * el propio archivo para que siga siendo visible aunque se copie a otro sitio.
 */
export function buildDump(captures: Capture[]): string {
  return JSON.stringify(
    {
      protocolVersion: CAPTURE_PROTOCOL_VERSION,
      exportedAt: new Date().toISOString(),
      advertencia:
        'Contiene datos bancarios reales. No commitear, no compartir, borrar tras el análisis.',
      count: captures.length,
      captures,
    },
    null,
    2,
  );
}
