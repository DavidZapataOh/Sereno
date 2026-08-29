import { assert, array, bigInt, integer, property } from 'fast-check';
import { add, allocate, compare, money, negate, subtract, sum, zero } from './money';

const monto = bigInt({ min: -1_000_000_000_000n, max: 1_000_000_000_000n }).map((amount) =>
  money(amount, 'COP'),
);

const proporciones = array(integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 24 });

describe('propiedades de la suma', () => {
  it('es conmutativa', () => {
    assert(
      property(monto, monto, (a, b) => {
        expect(add(a, b)).toEqual(add(b, a));
      }),
    );
  });

  it('es asociativa', () => {
    assert(
      property(monto, monto, monto, (a, b, c) => {
        expect(add(add(a, b), c)).toEqual(add(a, add(b, c)));
      }),
    );
  });

  it('el cero es el elemento neutro', () => {
    assert(
      property(monto, (a) => {
        expect(add(a, zero('COP'))).toEqual(a);
      }),
    );
  });

  it('restar es sumar el opuesto', () => {
    assert(
      property(monto, monto, (a, b) => {
        expect(subtract(a, b)).toEqual(add(a, negate(b)));
      }),
    );
  });

  it('sumar y restar el mismo valor devuelve el original', () => {
    assert(
      property(monto, monto, (a, b) => {
        expect(subtract(add(a, b), b)).toEqual(a);
      }),
    );
  });
});

describe('propiedades de allocate', () => {
  it('el reparto suma SIEMPRE exactamente el original', () => {
    // La propiedad que hace posible una cuota honesta: ni un peso perdido, ni
    // un peso inventado, sea cual sea el monto y el número de partes.
    assert(
      property(monto, proporciones, (a, ratios) => {
        expect(sum(allocate(a, ratios), 'COP')).toEqual(a);
      }),
    );
  });

  it('devuelve tantas partes como proporciones', () => {
    assert(
      property(monto, proporciones, (a, ratios) => {
        expect(allocate(a, ratios)).toHaveLength(ratios.length);
      }),
    );
  });

  it('todas las partes conservan el signo del original', () => {
    assert(
      property(monto, proporciones, (a, ratios) => {
        allocate(a, ratios).forEach((parte) => {
          if (a.amount > 0n) expect(parte.amount).toBeGreaterThanOrEqual(0n);
          if (a.amount < 0n) expect(parte.amount).toBeLessThanOrEqual(0n);
        });
      }),
    );
  });

  it('dos partes con la misma proporción difieren como mucho en una unidad', () => {
    assert(
      property(monto, integer({ min: 2, max: 24 }), (a, n) => {
        const magnitudes = allocate(
          a,
          Array.from({ length: n }, () => 1),
        ).map((p) => (p.amount < 0n ? -p.amount : p.amount));
        const max = magnitudes.reduce((x, y) => (x > y ? x : y));
        const min = magnitudes.reduce((x, y) => (x < y ? x : y));
        expect(max - min).toBeLessThanOrEqual(1n);
      }),
    );
  });
});

describe('propiedades de compare', () => {
  /**
   * Normaliza -0 a 0.
   *
   * `toBe` usa `Object.is`, que distingue 0 de -0, y negar un `compare` que
   * devolvió 0 —el caso de dos importes iguales— produce exactamente -0. Sin
   * esta normalización la propiedad falla de forma intermitente, solo cuando
   * fast-check genera por azar dos montos iguales.
   */
  const sinCeroNegativo = (n: number): number => (Object.is(n, -0) ? 0 : n);

  it('es antisimétrica', () => {
    assert(
      property(monto, monto, (a, b) => {
        expect(compare(a, b)).toBe(sinCeroNegativo(-compare(b, a)));
      }),
    );
  });

  it('un valor es igual a sí mismo', () => {
    assert(
      property(monto, (a) => {
        expect(compare(a, a)).toBe(0);
      }),
    );
  });
});

describe('inmutabilidad', () => {
  it('ninguna operación modifica sus argumentos', () => {
    assert(
      property(monto, monto, (a, b) => {
        const copiaA = { ...a };
        const copiaB = { ...b };
        add(a, b);
        subtract(a, b);
        negate(a);
        allocate(a, [1, 2, 3]);
        expect(a).toEqual(copiaA);
        expect(b).toEqual(copiaB);
      }),
    );
  });
});
