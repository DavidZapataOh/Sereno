import type { PortalId } from '@/domain/portals/registry';

import type { NormalizedTransaction } from './normalized-transaction';
import { extractBancolombia } from './portals-field-maps';
import type { Capture } from './reassembler';

export type Extractor = (capture: Capture) => NormalizedTransaction[];

/** Fragmento de URL que identifica el endpoint de movimientos de cada portal. */
const ENDPOINTS: Partial<Record<PortalId, { movimientos: string; extraer: Extractor }>> = {
  bancolombia: {
    movimientos: '/ch-ms-deposits/account/transactions',
    extraer: extractBancolombia,
  },
  // Nequi no expone movimientos por web (hallazgos del sprint 01). Va por
  // correo en el sprint 06.
};

/**
 * Extractor de movimientos de un portal, o `null` si el portal no los expone.
 *
 * Filtra por endpoint antes de intentar extraer: una sesión bancaria captura
 * decenas de respuestas, y solo una es la de movimientos. Intentar extraer de
 * todas produciría `[]` silenciosos que esconden un cambio de ruta del banco.
 */
export function extractorFor(portal: PortalId): Extractor | null {
  const spec = ENDPOINTS[portal];
  if (spec === undefined) return null;
  return (capture) => (capture.url.includes(spec.movimientos) ? spec.extraer(capture) : []);
}
