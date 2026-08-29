import type { PortalId } from '@/domain/portals/registry';
import { parseAmount } from './amount';
import { normalizedTransactionSchema, type NormalizedTransaction } from './normalized-transaction';
import type { Capture } from './reassembler';

export interface FieldMap {
  /** Ruta al arreglo de movimientos. Cadena vacía si la lista es la raíz. */
  listPath: string;
  fecha: string;
  descripcion: string;
  monto: string;
  referencia?: string;
  /**
   * Campo que indica la dirección del movimiento.
   *
   * Si se omite, se deduce del signo del monto. Algunos portales entregan
   * siempre montos positivos y la dirección en un campo aparte; usar el signo en
   * ese caso marcaría todo como ingreso.
   */
  tipo?: { path: string; debito: string };
}

export function getByPath(source: unknown, path: string): unknown {
  if (path.length === 0) return source;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, source);
}

function resolveTipo(row: unknown, map: FieldMap, amount: number): 'debito' | 'credito' {
  if (map.tipo !== undefined) {
    const marca = getByPath(row, map.tipo.path);
    return marca === map.tipo.debito ? 'debito' : 'credito';
  }
  return amount < 0 ? 'debito' : 'credito';
}

/**
 * Construye un extractor para un portal a partir de un mapa de rutas.
 *
 * La forma real del JSON de cada banco se descubre en la validación de campo;
 * aquí solo se declara dónde vive cada dato. Añadir un banco no exige tocar este
 * motor.
 */
export function createExtractor(
  fuente: PortalId,
  map: FieldMap,
): (capture: Capture) => NormalizedTransaction[] {
  return (capture) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(capture.body);
    } catch {
      return [];
    }

    const list = getByPath(parsed, map.listPath);
    if (!Array.isArray(list)) return [];

    const result: NormalizedTransaction[] = [];
    for (const row of list) {
      const amount = parseAmount(getByPath(row, map.monto));
      if (amount === null) continue;

      const referenciaRaw =
        map.referencia === undefined ? undefined : getByPath(row, map.referencia);

      const candidate = {
        fecha: getByPath(row, map.fecha),
        descripcion: getByPath(row, map.descripcion),
        monto: Math.abs(amount),
        moneda: 'COP',
        tipo: resolveTipo(row, map, amount),
        fuente,
        referencia: typeof referenciaRaw === 'string' ? referenciaRaw : null,
      };

      const validated = normalizedTransactionSchema.safeParse(candidate);
      if (validated.success) result.push(validated.data);
    }
    return result;
  };
}
