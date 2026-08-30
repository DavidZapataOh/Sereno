import type { PortalId } from '@/domain/portals/registry';

/**
 * De dónde puede venir un movimiento. Es más ancho que `PortalId`: Nu y
 * RappiCard no tienen portal web, solo mandan correo.
 */
export type SourceId = PortalId | 'nu' | 'rappicard';

export interface SourceSpec {
  nombre: string;
  /** Por dónde llegan sus datos. */
  canal: 'portal' | 'correo' | 'ambos';
  /**
   * Qué cuenta abre en el ledger.
   *
   * Una tarjeta de crédito es un **pasivo**: su saldo es deuda. Crearla como
   * activo pondría el patrimonio al revés sin que nada fallara.
   */
  cuenta: { numero: string; kind: 'activo' | 'pasivo' };
}

export const SOURCES: Record<SourceId, SourceSpec> = {
  bancolombia: {
    nombre: 'Bancolombia',
    canal: 'ambos',
    cuenta: { numero: 'ahorros', kind: 'activo' },
  },
  // La web de Nequi no expone movimientos (hallazgos del sprint 01): el
  // portal sirve para ver, el correo es el que trae los datos. Y solo una
  // parte: ver la tabla de cobertura del sprint 06.
  nequi: { nombre: 'Nequi', canal: 'correo', cuenta: { numero: 'ahorros', kind: 'activo' } },
  nu: { nombre: 'Nu', canal: 'correo', cuenta: { numero: 'tarjeta', kind: 'pasivo' } },
  rappicard: {
    nombre: 'RappiCard',
    canal: 'correo',
    cuenta: { numero: 'tarjeta', kind: 'pasivo' },
  },
};

export const SOURCE_IDS = Object.keys(SOURCES) as readonly SourceId[];

export function esSourceId(valor: string): valor is SourceId {
  return Object.prototype.hasOwnProperty.call(SOURCES, valor);
}
