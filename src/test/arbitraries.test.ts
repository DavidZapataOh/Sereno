import { assert, property } from 'fast-check';
import { isoDate, positiveAmount } from './arbitraries';

describe('positiveAmount', () => {
  it('genera solo enteros positivos', () => {
    assert(
      property(positiveAmount, (amount) => {
        expect(Number.isInteger(amount)).toBe(true);
        expect(amount).toBeGreaterThan(0);
      }),
    );
  });

  it('genera montos dentro de un rango realista en pesos', () => {
    assert(
      property(positiveAmount, (amount) => {
        expect(amount).toBeLessThanOrEqual(1_000_000_000);
      }),
    );
  });
});

describe('isoDate', () => {
  it('genera fechas ISO válidas', () => {
    assert(
      property(isoDate, (valor) => {
        expect(Number.isNaN(Date.parse(valor))).toBe(false);
      }),
    );
  });

  it('genera fechas con zona horaria explícita', () => {
    assert(
      property(isoDate, (valor) => {
        expect(valor.endsWith('Z')).toBe(true);
      }),
    );
  });
});
