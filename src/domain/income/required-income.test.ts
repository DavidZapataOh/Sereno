import { money } from '@/domain/money/money';

import { calcular, sinDatos } from './required-income';

const COP = 'COP' as const;

const entradas = (comprometido: number, habitual: number, aportes: number) => ({
  comprometido: money(comprometido, COP),
  habitualNoComprometido: money(habitual, COP),
  aportes: money(aportes, COP),
});

describe('calcular', () => {
  /** Si alguna rompe el orden, algo se está contando dos veces. */
  it('las tres cifras crecen en orden: mínimo ≤ sostener ≤ con metas', () => {
    const r = calcular(entradas(1_000_000, 800_000, 400_000));

    expect(r.minimo.amount).toBeLessThanOrEqual(r.sostener.amount);
    expect(r.sostener.amount).toBeLessThanOrEqual(r.conMetas.amount);
  });

  it('el mínimo es solo lo comprometido', () => {
    expect(calcular(entradas(1_000_000, 800_000, 400_000)).minimo.amount).toBe(1_000_000n);
  });

  it('sostener añade el gasto habitual', () => {
    expect(calcular(entradas(1_000_000, 800_000, 400_000)).sostener.amount).toBe(1_800_000n);
  });

  it('con metas añade los aportes', () => {
    expect(calcular(entradas(1_000_000, 800_000, 400_000)).conMetas.amount).toBe(2_200_000n);
  });

  /**
   * Una suscripción es comprometida **y** aparece en el gasto habitual del mes.
   * Sumarla dos veces inflaría el número justo en la dirección que desanima.
   */
  it('no cuenta dos veces lo que es a la vez comprometido y habitual', () => {
    // El habitual llega ya descontado: es responsabilidad de quien lo calcula,
    // y el tipo lo dice en su nombre.
    const r = calcular(entradas(500_000, 0, 0));

    expect(r.sostener.amount).toBe(500_000n);
  });

  it('sin metas, «con metas» iguala «sostener»', () => {
    const r = calcular(entradas(1_000_000, 800_000, 0));

    expect(r.conMetas.amount).toBe(r.sostener.amount);
  });

  it('sin nada, las tres son cero y no falla', () => {
    const r = calcular(entradas(0, 0, 0));

    expect([r.minimo.amount, r.sostener.amount, r.conMetas.amount]).toEqual([0n, 0n, 0n]);
  });
});

describe('sinDatos', () => {
  it('devuelve tres ceros, no un error', () => {
    const r = sinDatos(COP);

    expect(r.minimo.amount).toBe(0n);
    expect(r.conMetas.amount).toBe(0n);
  });
});
