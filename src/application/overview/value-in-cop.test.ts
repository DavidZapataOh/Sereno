import { money } from '@/domain/money/money';
import { rate, type Rate } from '@/domain/rates/rate';

import { valorarEnCOP } from './value-in-cop';

/** Las tasas reales del 2026-08-31. */
const TRM: Rate = rate({
  desde: 'USD',
  hacia: 'COP',
  valor: 320_279n,
  escala: 2,
  origen: 'TRM oficial',
  momento: '2026-08-29T00:00:00.000-05:00',
});
const PRECIO_USDC: Rate = rate({
  desde: 'USDC',
  hacia: 'USD',
  valor: 100_018_000n,
  escala: 8,
  origen: 'Binance',
  momento: '2026-08-31T10:00:00.000-05:00',
});

describe('valorarEnCOP', () => {
  it('lo que ya está en pesos se queda como está', () => {
    const r = valorarEnCOP(money(80_000, 'COP'), []);

    expect(r).toEqual({ estado: 'valorado', enPesos: money(80_000, 'COP'), tasa: null });
  });

  it('convierte USDC encadenando el precio y la TRM', () => {
    // El saldo real de Solana: 0,085761 USDC → unos 274 pesos.
    const r = valorarEnCOP(money(85_761n, 'USDC'), [PRECIO_USDC, TRM]);

    expect(r.estado).toBe('valorado');
    if (r.estado !== 'valorado') return;
    expect(r.enPesos.amount).toBeGreaterThan(270n);
    expect(r.enPesos.amount).toBeLessThan(280n);
  });

  /**
   * «Tu patrimonio son X pesos» sin decir de dónde salió la tasa es un número,
   * no una respuesta.
   */
  it('dice con qué tasa se valoró y de cuándo es', () => {
    const r = valorarEnCOP(money(85_761n, 'USDC'), [PRECIO_USDC, TRM]);

    if (r.estado !== 'valorado') throw new Error('debería haberse valorado');
    expect(r.tasa?.origen).toContain('TRM');
    // La compuesta se queda con el momento del eslabón más viejo.
    expect(r.tasa?.momento).toBe('2026-08-29T00:00:00.000-05:00');
  });

  /**
   * Sin tasa, el saldo **no vale cero**: vale «no se pudo valorar». Sumarlo
   * como cero es la forma más silenciosa de que el patrimonio mienta.
   */
  it('sin tasa devuelve el saldo sin valorar, no cero', () => {
    const r = valorarEnCOP(money(85_761n, 'USDC'), []);

    expect(r).toEqual({ estado: 'sin-valorar', original: money(85_761n, 'USDC') });
  });

  it('con solo media cadena tampoco inventa la otra mitad', () => {
    expect(valorarEnCOP(money(85_761n, 'USDC'), [PRECIO_USDC]).estado).toBe('sin-valorar');
    expect(valorarEnCOP(money(85_761n, 'USDC'), [TRM]).estado).toBe('sin-valorar');
  });

  it('una tasa vieja sirve igual: lo que importa es poder decir de cuándo es', () => {
    const vieja: Rate = { ...TRM, momento: '2026-01-01T00:00:00.000-05:00' };

    const r = valorarEnCOP(money(100, 'USD'), [vieja]);

    expect(r.estado).toBe('valorado');
    if (r.estado !== 'valorado') return;
    expect(r.tasa?.momento).toBe('2026-01-01T00:00:00.000-05:00');
  });

  it('un saldo negativo se valora igual: una deuda en dólares es una deuda', () => {
    const r = valorarEnCOP(money(-100, 'USD'), [TRM]);

    if (r.estado !== 'valorado') throw new Error('debería haberse valorado');
    expect(r.enPesos.amount).toBeLessThan(0n);
  });

  it('cero se valora en cero', () => {
    const r = valorarEnCOP(money(0n, 'USDC'), [PRECIO_USDC, TRM]);

    if (r.estado !== 'valorado') throw new Error('debería haberse valorado');
    expect(r.enPesos.amount).toBe(0n);
  });
});
