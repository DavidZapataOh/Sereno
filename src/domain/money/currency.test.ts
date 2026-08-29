import { CURRENCIES, getCurrency } from './currency';

describe('CURRENCIES', () => {
  it('el peso colombiano no tiene decimales', () => {
    expect(CURRENCIES.COP.scale).toBe(0);
  });

  it('el dólar tiene dos decimales', () => {
    expect(CURRENCIES.USD.scale).toBe(2);
  });

  it('bitcoin tiene ocho decimales', () => {
    expect(CURRENCIES.BTC.scale).toBe(8);
  });

  it('ether tiene dieciocho decimales', () => {
    expect(CURRENCIES.ETH.scale).toBe(18);
  });

  it('toda escala es un entero no negativo', () => {
    Object.values(CURRENCIES).forEach((moneda) => {
      expect(Number.isInteger(moneda.scale)).toBe(true);
      expect(moneda.scale).toBeGreaterThanOrEqual(0);
    });
  });

  it('el código de la moneda coincide con su clave', () => {
    Object.entries(CURRENCIES).forEach(([clave, moneda]) => {
      expect(moneda.code).toBe(clave);
    });
  });
});

describe('getCurrency', () => {
  it('devuelve la moneda por su código', () => {
    expect(getCurrency('COP')?.scale).toBe(0);
  });

  it('devuelve undefined para un código desconocido', () => {
    expect(getCurrency('XYZ')).toBeUndefined();
  });

  it('no confunde propiedades heredadas con monedas', () => {
    expect(getCurrency('toString')).toBeUndefined();
  });
});
