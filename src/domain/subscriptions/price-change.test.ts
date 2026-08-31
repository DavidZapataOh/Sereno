import { transactionId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import { priceChangeOf } from './price-change';
import type { Subscription } from './subscription';

const base: Subscription = {
  clave: 'netflix',
  comercio: 'Netflix',
  cadencia: 'mensual',
  monto: money(44_900, 'COP'),
  ultimoCobro: '2026-08-05',
  proximoCobro: '2026-09-04',
  cobros: [transactionId('a'), transactionId('b')],
  historial: [money(38_900, 'COP'), money(44_900, 'COP')],
  confianza: 1,
};

describe('priceChangeOf', () => {
  it('detecta una subida', () => {
    const cambio = priceChangeOf(base);

    expect(cambio?.anterior.amount).toBe(38_900n);
    expect(cambio?.nuevo.amount).toBe(44_900n);
    expect(cambio?.porcentaje).toBeCloseTo(15.4, 1);
  });

  it('detecta una bajada, que también interesa', () => {
    const cambio = priceChangeOf({
      ...base,
      historial: [money(44_900, 'COP'), money(38_900, 'COP')],
    });

    expect(cambio?.porcentaje).toBeLessThan(0);
  });

  /**
   * Unos pesos entre cobros son impuesto o redondeo, no una subida. Avisar de
   * eso todos los meses enseña a ignorar los avisos.
   */
  it('una diferencia de menos del 2 % no es un cambio de precio', () => {
    expect(
      priceChangeOf({ ...base, historial: [money(38_900, 'COP'), money(39_000, 'COP')] }),
    ).toBeNull();
  });

  it('justo en el umbral todavía no avisa', () => {
    // 2 % exacto: el umbral es «más de», no «al menos».
    expect(
      priceChangeOf({ ...base, historial: [money(100_000, 'COP'), money(102_000, 'COP')] }),
    ).toBeNull();
  });

  it('compara los dos últimos, no el primero con el último', () => {
    // Subió y volvió a bajar al precio original: no hay cambio que avisar hoy.
    const cambio = priceChangeOf({
      ...base,
      historial: [money(38_900, 'COP'), money(44_900, 'COP'), money(44_900, 'COP')],
    });

    expect(cambio).toBeNull();
  });

  it('sin cobros suficientes no hay cambio que reportar', () => {
    expect(priceChangeOf({ ...base, historial: [money(38_900, 'COP')] })).toBeNull();
    expect(priceChangeOf({ ...base, historial: [] })).toBeNull();
  });

  it('un cobro anterior de cero no divide por cero', () => {
    expect(
      priceChangeOf({ ...base, historial: [money(0, 'COP'), money(38_900, 'COP')] }),
    ).toBeNull();
  });
});
