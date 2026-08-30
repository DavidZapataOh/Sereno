import { normalizedTransactionSchema } from '@/domain/capture/normalized-transaction';
import { PORTALS } from '@/domain/portals/registry';

import { esSourceId, SOURCE_IDS, SOURCES } from './registry';

describe('registro de fuentes', () => {
  it('incluye los portales y las fuentes que solo llegan por correo', () => {
    expect(SOURCE_IDS).toEqual(['bancolombia', 'nequi', 'nu', 'rappicard']);
    for (const portal of PORTALS) expect(SOURCE_IDS).toContain(portal.id);
  });

  it('las tarjetas de crédito abren una cuenta de pasivo, no de activo', () => {
    // Crearlas como activo pondría el patrimonio al revés sin que nada fallara.
    expect(SOURCES.nu.cuenta).toEqual({ numero: 'tarjeta', kind: 'pasivo' });
    expect(SOURCES.rappicard.cuenta.kind).toBe('pasivo');
    expect(SOURCES.bancolombia.cuenta).toEqual({ numero: 'ahorros', kind: 'activo' });
  });

  it('cada fuente dice por dónde llega', () => {
    expect(SOURCES.bancolombia.canal).toBe('ambos');
    expect(SOURCES.nu.canal).toBe('correo');
    expect(SOURCES.nequi.canal).toBe('correo');
  });

  it('reconoce lo que es una fuente y lo que no', () => {
    expect(esSourceId('nu')).toBe(true);
    expect(esSourceId('davivienda')).toBe(false);
  });

  it('el esquema del dominio acepta exactamente las fuentes del registro', () => {
    const base = {
      fecha: '2026-08-30T00:00:00.000-05:00',
      descripcion: 'x',
      monto: 1000,
      moneda: 'COP',
      tipo: 'debito',
      referencia: 'R1',
    };
    for (const id of SOURCE_IDS) {
      expect(() => normalizedTransactionSchema.parse({ ...base, fuente: id })).not.toThrow();
    }
    expect(() => normalizedTransactionSchema.parse({ ...base, fuente: 'davivienda' })).toThrow();
  });
});
