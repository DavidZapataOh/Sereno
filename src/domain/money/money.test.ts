import {
  absolute,
  add,
  allocate,
  compare,
  CurrencyMismatchError,
  isNegative,
  isZero,
  money,
  multiply,
  negate,
  subtract,
  sum,
  zero,
} from './money';

describe('money', () => {
  it('crea un valor a partir de un entero', () => {
    expect(money(45000, 'COP')).toEqual({ amount: 45000n, currency: 'COP' });
  });

  it('acepta un bigint', () => {
    expect(money(45000n, 'COP').amount).toBe(45000n);
  });

  it('rechaza un número con decimales', () => {
    expect(() => money(45.5, 'COP')).toThrow(/entero/i);
  });

  it('rechaza un número no finito', () => {
    expect(() => money(Number.NaN, 'COP')).toThrow();
  });

  it('rechaza un número fuera del rango seguro', () => {
    expect(() => money(Number.MAX_SAFE_INTEGER + 2, 'COP')).toThrow(/seguro/i);
  });

  it('acepta montos negativos: un apunte de crédito lo es', () => {
    expect(money(-45000, 'COP').amount).toBe(-45000n);
  });
});

describe('add y subtract', () => {
  it('suma dos montos de la misma moneda', () => {
    expect(add(money(1000, 'COP'), money(500, 'COP'))).toEqual(money(1500, 'COP'));
  });

  it('resta dos montos de la misma moneda', () => {
    expect(subtract(money(1000, 'COP'), money(300, 'COP'))).toEqual(money(700, 'COP'));
  });

  it('sumar monedas distintas es un error', () => {
    expect(() => add(money(1000, 'COP'), money(10, 'USD'))).toThrow(CurrencyMismatchError);
  });

  it('el error dice qué monedas se intentó mezclar', () => {
    expect(() => add(money(1000, 'COP'), money(10, 'USD'))).toThrow(/COP.*USD|USD.*COP/);
  });

  it('maneja montos enormes sin perder precisión', () => {
    const grande = money(9_007_199_254_740_991n * 1000n, 'COP');
    expect(add(grande, money(1, 'COP')).amount).toBe(9_007_199_254_740_991n * 1000n + 1n);
  });

  it('un ether en wei no desborda', () => {
    const unEther = money(10n ** 18n, 'ETH');
    expect(add(unEther, unEther).amount).toBe(2n * 10n ** 18n);
  });
});

describe('negate, absolute y predicados', () => {
  it('negate invierte el signo', () => {
    expect(negate(money(1000, 'COP'))).toEqual(money(-1000, 'COP'));
  });

  it('negate del cero sigue siendo cero', () => {
    expect(negate(zero('COP'))).toEqual(zero('COP'));
  });

  it('absolute quita el signo', () => {
    expect(absolute(money(-1000, 'COP'))).toEqual(money(1000, 'COP'));
  });

  it('isZero reconoce el cero', () => {
    expect(isZero(zero('COP'))).toBe(true);
    expect(isZero(money(1, 'COP'))).toBe(false);
  });

  it('isNegative reconoce el signo', () => {
    expect(isNegative(money(-1, 'COP'))).toBe(true);
    expect(isNegative(zero('COP'))).toBe(false);
  });
});

describe('multiply', () => {
  it('multiplica por un entero', () => {
    expect(multiply(money(1000, 'COP'), { numerator: 3n, denominator: 1n })).toEqual(
      money(3000, 'COP'),
    );
  });

  it('multiplica por una fracción y trunca hacia cero', () => {
    expect(multiply(money(1000, 'COP'), { numerator: 335n, denominator: 1000n })).toEqual(
      money(335, 'COP'),
    );
  });

  it('trunca hacia cero también con negativos', () => {
    expect(multiply(money(-1000, 'COP'), { numerator: 335n, denominator: 1000n })).toEqual(
      money(-335, 'COP'),
    );
  });

  it('rechaza denominador cero', () => {
    expect(() => multiply(money(1000, 'COP'), { numerator: 1n, denominator: 0n })).toThrow();
  });
});

describe('allocate', () => {
  it('reparte en partes iguales cuando divide exacto', () => {
    expect(allocate(money(300, 'COP'), [1, 1, 1])).toEqual([
      money(100, 'COP'),
      money(100, 'COP'),
      money(100, 'COP'),
    ]);
  });

  it('reparte el resto entre las primeras partes', () => {
    expect(allocate(money(100, 'COP'), [1, 1, 1])).toEqual([
      money(34, 'COP'),
      money(33, 'COP'),
      money(33, 'COP'),
    ]);
  });

  it('el reparto suma exactamente el original', () => {
    const partes = allocate(money(1_000_000, 'COP'), [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(sum(partes, 'COP')).toEqual(money(1_000_000, 'COP'));
  });

  it('respeta proporciones desiguales', () => {
    expect(allocate(money(1000, 'COP'), [3, 1])).toEqual([money(750, 'COP'), money(250, 'COP')]);
  });

  it('reparte un monto negativo conservando el signo', () => {
    const partes = allocate(money(-100, 'COP'), [1, 1, 1]);
    expect(sum(partes, 'COP')).toEqual(money(-100, 'COP'));
    partes.forEach((parte) => {
      expect(isNegative(parte)).toBe(true);
    });
  });

  it('rechaza una lista de proporciones vacía', () => {
    expect(() => allocate(money(100, 'COP'), [])).toThrow();
  });

  it('rechaza proporciones que suman cero', () => {
    expect(() => allocate(money(100, 'COP'), [0, 0])).toThrow();
  });

  it('rechaza proporciones negativas', () => {
    expect(() => allocate(money(100, 'COP'), [1, -1])).toThrow();
  });
});

describe('compare y sum', () => {
  it('compare ordena correctamente', () => {
    expect(compare(money(1, 'COP'), money(2, 'COP'))).toBe(-1);
    expect(compare(money(2, 'COP'), money(1, 'COP'))).toBe(1);
    expect(compare(money(1, 'COP'), money(1, 'COP'))).toBe(0);
  });

  it('comparar monedas distintas es un error', () => {
    expect(() => compare(money(1, 'COP'), money(1, 'USD'))).toThrow(CurrencyMismatchError);
  });

  it('sum de una lista vacía es cero en la moneda dada', () => {
    expect(sum([], 'COP')).toEqual(zero('COP'));
  });

  it('sum acumula la lista', () => {
    expect(sum([money(100, 'COP'), money(200, 'COP'), money(-50, 'COP')], 'COP')).toEqual(
      money(250, 'COP'),
    );
  });

  it('sum rechaza una lista con monedas mezcladas', () => {
    expect(() => sum([money(100, 'COP'), money(1, 'USD')], 'COP')).toThrow(CurrencyMismatchError);
  });
});
