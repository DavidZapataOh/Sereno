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
  /**
   * Si por sus canales llegan **todos** sus movimientos o solo algunos.
   *
   * Comprobado con correos reales (sprint 06): Nequi solo avisa de Bre-B y Nu
   * solo del pago de la cuota. Un saldo parcial que se muestra como si fuera
   * completo miente más que un hueco declarado, así que esto se enseña en
   * pantalla. Cambia cuando llegue el sprint 06b.
   */
  cobertura: 'completa' | 'parcial';
}

export const SOURCES: Record<SourceId, SourceSpec> = {
  bancolombia: {
    nombre: 'Bancolombia',
    canal: 'ambos',
    cuenta: { numero: 'ahorros', kind: 'activo' },
    cobertura: 'completa',
  },
  // La web de Nequi no expone movimientos (hallazgos del sprint 01): el
  // portal sirve para ver, el correo es el que trae los datos. Y solo una
  // parte: ver la tabla de cobertura del sprint 06.
  nequi: {
    nombre: 'Nequi',
    canal: 'correo',
    cuenta: { numero: 'ahorros', kind: 'activo' },
    // Solo avisa de Bre-B: ni transferencias normales, ni QR, ni tarjeta.
    cobertura: 'parcial',
  },
  nu: {
    nombre: 'Nu',
    canal: 'correo',
    cuenta: { numero: 'tarjeta', kind: 'pasivo' },
    // Solo el pago de la cuota. Ninguna compra.
    cobertura: 'parcial',
  },
  rappicard: {
    nombre: 'RappiCard',
    canal: 'correo',
    cuenta: { numero: 'tarjeta', kind: 'pasivo' },
    cobertura: 'completa',
  },
};

export const SOURCE_IDS = Object.keys(SOURCES) as readonly SourceId[];

export function esSourceId(valor: string): valor is SourceId {
  return Object.prototype.hasOwnProperty.call(SOURCES, valor);
}

/** La fuente a la que pertenece una cuenta, por su id `fuente:numero`. */
export function sourceOfAccount(id: string): SourceId | null {
  const fuente = id.split(':')[0] ?? '';
  return esSourceId(fuente) ? fuente : null;
}
