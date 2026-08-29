import { parseAmount } from './amount';

describe('parseAmount — números', () => {
  it.each([
    [45000, 45000],
    [-45000, -45000],
    [0, 0],
    [1234.99, 1234],
    [-1234.99, -1234],
  ])('interpreta el número %s como %s', (entrada, esperado) => {
    expect(parseAmount(entrada)).toBe(esperado);
  });

  it('rechaza valores no finitos', () => {
    expect(parseAmount(Number.NaN)).toBeNull();
    expect(parseAmount(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('parseAmount — formato colombiano', () => {
  it.each([
    ['1.234.567', 1234567],
    ['1.234.567,89', 1234567],
    ['-12.500,00', -12500],
    ['45.000', 45000],
    ['$ 1.200.000', 1200000],
    ['COP 45.000', 45000],
    ['1.200', 1200],
  ])('interpreta %s como %s', (entrada, esperado) => {
    expect(parseAmount(entrada)).toBe(esperado);
  });
});

describe('parseAmount — formato inglés', () => {
  it.each([
    ['1,234,567.89', 1234567],
    ['1234567.89', 1234567],
    ['-12,500.00', -12500],
    ['45,000', 45000],
  ])('interpreta %s como %s', (entrada, esperado) => {
    expect(parseAmount(entrada)).toBe(esperado);
  });
});

describe('parseAmount — casos ambiguos', () => {
  it('un separador único seguido de tres dígitos es de miles', () => {
    expect(parseAmount('1.200')).toBe(1200);
    expect(parseAmount('1,200')).toBe(1200);
  });

  it('un separador único seguido de uno o dos dígitos es decimal', () => {
    expect(parseAmount('1.2')).toBe(1);
    expect(parseAmount('1,25')).toBe(1);
  });

  it('el separador más a la derecha manda cuando hay de los dos', () => {
    expect(parseAmount('1.234,56')).toBe(1234);
    expect(parseAmount('1,234.56')).toBe(1234);
  });
});

describe('parseAmount — signos', () => {
  it.each([
    ['-45.000', -45000],
    ['(45.000)', -45000],
    ['45.000-', -45000],
    ['+45.000', 45000],
  ])('interpreta el signo de %s como %s', (entrada, esperado) => {
    expect(parseAmount(entrada)).toBe(esperado);
  });
});

describe('parseAmount — entradas no interpretables', () => {
  it.each([null, undefined, '', '   ', 'abc', {}, [], true, '$', '-'])(
    'devuelve null para %p',
    (entrada) => {
      expect(parseAmount(entrada)).toBeNull();
    },
  );
});
