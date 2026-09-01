import { anualDe, mensualDe } from './rate';

describe('mensualDe', () => {
  /**
   * La conversión que casi todo el mundo hace mal: dividir la efectiva anual
   * entre doce. Con 24 % E.A. eso da 2,0 % mensual, y la buena es 1,809 %.
   * Sobre un saldo de diez millones son unos 19.000 pesos al mes de más, y con
   * eso la fecha de salida se corre meses.
   */
  it('convierte efectiva anual con la raíz, no dividiendo entre doce', () => {
    expect(mensualDe({ valor: 0.24, tipo: 'EA' })).toBeCloseTo(0.018088, 6);
    expect(mensualDe({ valor: 0.24, tipo: 'EA' })).not.toBeCloseTo(0.02, 4);
  });

  it('una mes vencido ya es mensual: se devuelve tal cual', () => {
    expect(mensualDe({ valor: 0.02, tipo: 'MV' })).toBe(0.02);
  });

  it('tasa cero es cero', () => {
    expect(mensualDe({ valor: 0, tipo: 'EA' })).toBe(0);
    expect(mensualDe({ valor: 0, tipo: 'MV' })).toBe(0);
  });

  /** Una tarjeta colombiana ronda el 25–30 % E.A. La cifra tiene que salir creíble. */
  it('con la tasa de usura típica da un mensual de un dos por ciento largo', () => {
    const mensual = mensualDe({ valor: 0.28, tipo: 'EA' });

    expect(mensual).toBeGreaterThan(0.02);
    expect(mensual).toBeLessThan(0.021);
  });

  it('la mensual siempre es menor que la anual dividida entre doce', () => {
    // El interés compuesto: por eso dividir entre doce se pasa, nunca se queda corto.
    for (const ea of [0.05, 0.12, 0.24, 0.36, 0.5]) {
      expect(mensualDe({ valor: ea, tipo: 'EA' })).toBeLessThan(ea / 12);
    }
  });
});

describe('anualDe', () => {
  it('una efectiva anual se devuelve tal cual', () => {
    expect(anualDe({ valor: 0.24, tipo: 'EA' })).toBe(0.24);
  });

  it('convierte mes vencido a efectiva anual componiendo doce meses', () => {
    // 2 % mensual compuesto doce veces es 26,8 % E.A., no 24 %.
    expect(anualDe({ valor: 0.02, tipo: 'MV' })).toBeCloseTo(0.268242, 6);
  });

  it('ida y vuelta: la anual de la mensual devuelve la anual', () => {
    for (const ea of [0.05, 0.24, 0.4]) {
      const mensual = mensualDe({ valor: ea, tipo: 'EA' });
      expect(anualDe({ valor: mensual, tipo: 'MV' })).toBeCloseTo(ea, 10);
    }
  });
});
