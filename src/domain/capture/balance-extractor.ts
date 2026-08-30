import type { PortalId } from '@/domain/portals/registry';

import { parseAmount } from './amount';
import { getByPath } from './extractor';
import { normalizedBalanceSchema, type NormalizedBalance } from './normalized-balance';
import type { Capture } from './reassembler';

export interface BalanceFieldMap {
  listPath: string;
  numero: string;
  nombre: string;
  saldo: string;
}

export type BalanceExtractor = (capture: Capture) => NormalizedBalance[];

/** Mismo patrón que `createExtractor`: el mapa dice dónde vive cada dato. */
export function createBalanceExtractor(fuente: PortalId, map: BalanceFieldMap): BalanceExtractor {
  return (capture) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(capture.body);
    } catch {
      return [];
    }
    const list = getByPath(parsed, map.listPath);
    if (!Array.isArray(list)) return [];

    const result: NormalizedBalance[] = [];
    for (const row of list) {
      const saldo = parseAmount(getByPath(row, map.saldo));
      if (saldo === null) continue;
      const candidate = {
        fuente,
        numero: getByPath(row, map.numero),
        nombre: getByPath(row, map.nombre),
        moneda: 'COP',
        saldo: Math.trunc(saldo),
      };
      const validated = normalizedBalanceSchema.safeParse(candidate);
      if (validated.success) result.push(validated.data);
    }
    return result;
  };
}
