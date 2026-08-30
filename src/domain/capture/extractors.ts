import type { PortalId } from '@/domain/portals/registry';

import type { BalanceExtractor } from './balance-extractor';
import type { NormalizedTransaction } from './normalized-transaction';
import { extractBancolombia, extractBancolombiaBalances } from './portals-field-maps';
import type { Capture } from './reassembler';

export type Extractor = (capture: Capture) => NormalizedTransaction[];

interface PortalEndpoints {
  /** Fragmento de URL que identifica el endpoint de movimientos. */
  movimientos: string;
  extraer: Extractor;
  /** Fragmento de URL que identifica el endpoint de saldos. */
  saldos: string;
  extraerSaldos: BalanceExtractor;
}

const ENDPOINTS: Partial<Record<PortalId, PortalEndpoints>> = {
  bancolombia: {
    movimientos: '/ch-ms-deposits/account/transactions',
    extraer: extractBancolombia,
    saldos: '/hybrid/accounts/customization/consolidated',
    extraerSaldos: extractBancolombiaBalances,
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

/** Extractor de saldos de un portal, o `null` si no los expone por web. */
export function balanceExtractorFor(portal: PortalId): BalanceExtractor | null {
  const spec = ENDPOINTS[portal];
  if (spec === undefined) return null;
  return (capture) => (capture.url.includes(spec.saldos) ? spec.extraerSaldos(capture) : []);
}
