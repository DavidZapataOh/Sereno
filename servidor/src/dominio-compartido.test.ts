import { describe, expect, it } from 'vitest';

import { normalizedTransactionSchema } from '@/domain/capture/normalized-transaction';
import { fingerprintOf } from '@/domain/ingest/fingerprint';
import { formatCOP } from '@/domain/money/format';

/**
 * El servidor no define qué es un movimiento: lo importa del dominio de la
 * app. Si el alias se rompe o alguien copia el tipo, esta prueba lo dice.
 */
describe('dominio compartido con la app', () => {
  const movimiento = {
    fecha: '2026-08-30T00:00:00.000-05:00',
    descripcion: 'COMPRA EXITO SUR',
    monto: 45000,
    moneda: 'COP',
    tipo: 'debito',
    fuente: 'bancolombia',
    referencia: 'ABC123',
  };

  it('valida un movimiento con el mismo esquema que usa la app', () => {
    expect(normalizedTransactionSchema.parse(movimiento)).toEqual(movimiento);
  });

  it('rechaza lo que la app rechazaría: monto negativo', () => {
    expect(() => normalizedTransactionSchema.parse({ ...movimiento, monto: -1 })).toThrow();
  });

  it('calcula la misma huella que usa la deduplicación del teléfono', () => {
    expect(fingerprintOf(normalizedTransactionSchema.parse(movimiento))).toBe(
      '2026-08-30|45000|exito sur',
    );
  });

  it('formatea el dinero con las reglas del dominio, no con las del servidor', () => {
    expect(formatCOP(45000n)).toBe('45.000');
  });
});
