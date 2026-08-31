import { money } from '@/domain/money/money';
import { rate } from '@/domain/rates/rate';

import { esPolvo, POLVO_USD } from './dust';

/** La TRM real del 2026-08-31: 3.202,79 pesos por dólar, con escala 2. */
const TRM = rate({
  desde: 'USD',
  hacia: 'COP',
  valor: 320_279n,
  escala: 2,
  origen: 'TRM oficial',
  momento: '2026-08-31T00:00:00.000-05:00',
});

describe('esPolvo', () => {
  it('un saldo de medio dólar es polvo', () => {
    expect(esPolvo(money(1_600n, 'COP'), TRM)).toBe(true);
  });

  it('un saldo de dos dólares no lo es', () => {
    expect(esPolvo(money(6_405n, 'COP'), TRM)).toBe(false);
  });

  it('justo un dólar no es polvo: el umbral es «menos de»', () => {
    expect(esPolvo(money(3_202n, 'COP'), TRM)).toBe(false);
  });

  it('cero es polvo', () => {
    expect(esPolvo(money(0n, 'COP'), TRM)).toBe(true);
  });

  /**
   * Una deuda pequeña también es polvo: lo que se mira es el tamaño, no el
   * signo. Si no, un pasivo diminuto ensuciaría la lista igual.
   */
  it('mira el tamaño y no el signo', () => {
    expect(esPolvo(money(-1_600n, 'COP'), TRM)).toBe(true);
  });

  /**
   * Lo que no se pudo valorar **no** se esconde. Esconder por si acaso es
   * exactamente el error que el renglón de «sin valorar» existe para evitar.
   */
  it('sin valorar nunca es polvo', () => {
    expect(esPolvo(null, TRM)).toBe(false);
  });

  it('sin tasa tampoco', () => {
    expect(esPolvo(money(1n, 'COP'), null)).toBe(false);
  });

  it('el peso del umbral sale de la tasa, no de una constante en pesos', () => {
    // Con el dólar al doble, el umbral en pesos también se dobla.
    const caro = rate({ ...TRM, valor: 640_558n });

    expect(esPolvo(money(4_000n, 'COP'), TRM)).toBe(false);
    expect(esPolvo(money(4_000n, 'COP'), caro)).toBe(true);
  });

  it('el umbral es un dólar, y está declarado', () => {
    expect(POLVO_USD).toBe(1n);
  });
});
