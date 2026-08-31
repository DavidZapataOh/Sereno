import { assert, bigInt, property } from 'fast-check';

import { money } from '@/domain/money/money';

import { cadena, convertir } from './convert';
import { rate, type Rate } from './rate';

/** La TRM real del 29 al 31 de agosto de 2026: 3.202,79 pesos por dólar. */
const TRM: Rate = rate({
  desde: 'USD',
  hacia: 'COP',
  valor: 320_279n,
  escala: 2,
  origen: 'TRM oficial',
  momento: '2026-08-29T00:00:00.000-05:00',
});

/** El precio real de USDC el 2026-08-31: 1,00018 USDT. */
const PRECIO_USDC: Rate = rate({
  desde: 'USDC',
  hacia: 'USD',
  valor: 100_018_000n,
  escala: 8,
  origen: 'Binance',
  momento: '2026-08-31T10:00:00.000-05:00',
});

describe('rate', () => {
  it('rechaza una tasa que no es positiva', () => {
    expect(() => rate({ ...TRM, valor: 0n })).toThrow(/positiva/);
  });

  /**
   * Dentro de un mes, «3.202,79» sin más no dice si es de hoy, de ayer o de
   * una fuente que ya no existe.
   */
  it('rechaza una tasa sin origen', () => {
    expect(() => rate({ ...TRM, origen: '   ' })).toThrow(/origen/);
  });

  it('rechaza una tasa de una moneda a ella misma', () => {
    expect(() => rate({ ...TRM, hacia: 'USD' })).toThrow();
  });
});

describe('convertir', () => {
  it('convierte dólares a pesos con la TRM real', () => {
    // 10 USD = 1000 centavos → 32.027 pesos (el peso no tiene decimales).
    expect(convertir(money(1000, 'USD'), TRM).amount).toBe(32_027n);
  });

  it('respeta la escala de las dos monedas', () => {
    // 1 USD = 100 centavos → 3.202 pesos, truncando.
    expect(convertir(money(100, 'USD'), TRM).amount).toBe(3_202n);
  });

  it('convierte USDC a dólares con su precio real', () => {
    // 1 USDC = 1.000.000 unidades → 1,00018 USD → 100 centavos, truncado.
    expect(convertir(money(1_000_000n, 'USDC'), PRECIO_USDC).amount).toBe(100n);
  });

  it('cero se convierte en cero', () => {
    expect(convertir(money(0, 'USD'), TRM).amount).toBe(0n);
  });

  it('rechaza una tasa que no es la del monto', () => {
    expect(() => convertir(money(1000, 'USD'), PRECIO_USDC)).toThrow(/moneda/i);
  });

  /**
   * El redondeo existe y no se puede evitar al bajar de escala; lo que sí se
   * puede es acotarlo y dejarlo probado.
   */
  it('propiedad: nunca devuelve más de lo que la tasa permite', () => {
    assert(
      property(bigInt({ min: 0n, max: 10n ** 12n }), (monto) => {
        const enPesos = convertir(money(monto, 'USD'), TRM);
        // Cota superior: monto (en centavos) × tasa, sin decimales de pesos.
        return enPesos.amount <= (monto * TRM.valor) / 100n / 100n + 1n;
      }),
      { numRuns: 500 },
    );
  });

  it('propiedad: convertir nunca produce un negativo desde un positivo', () => {
    assert(
      property(bigInt({ min: 0n, max: 10n ** 15n }), (monto) => {
        return convertir(money(monto, 'USD'), TRM).amount >= 0n;
      }),
      { numRuns: 300 },
    );
  });
});

describe('cadena', () => {
  it('encadena USDC → USD → COP', () => {
    // El saldo real de Solana: 0,085761 USDC.
    const enPesos = cadena(money(85_761n, 'USDC'), [PRECIO_USDC, TRM], 'COP');

    expect(enPesos?.currency).toBe('COP');
    // Unos 275 pesos: 0,085761 × 1,00018 × 3.202,79.
    expect(enPesos?.amount).toBeGreaterThan(270n);
    expect(enPesos?.amount).toBeLessThan(280n);
  });

  it('el orden en que lleguen las tasas da igual', () => {
    const a = cadena(money(85_761n, 'USDC'), [PRECIO_USDC, TRM], 'COP');
    const b = cadena(money(85_761n, 'USDC'), [TRM, PRECIO_USDC], 'COP');

    expect(a).toEqual(b);
  });

  it('un monto que ya está en la moneda pedida se devuelve tal cual', () => {
    const m = money(80_000, 'COP');

    expect(cadena(m, [], 'COP')).toEqual(m);
  });

  /**
   * Sin una de las dos tasas no se inventa la otra: se devuelve `null` y quien
   * llama decide qué decir. Un cero se sumaría al patrimonio como si el saldo
   * no valiera nada.
   */
  it('sin alguna tasa devuelve null, no cero', () => {
    expect(cadena(money(85_761n, 'USDC'), [PRECIO_USDC], 'COP')).toBeNull();
    expect(cadena(money(85_761n, 'USDC'), [], 'COP')).toBeNull();
  });

  it('sin camino posible devuelve null', () => {
    expect(cadena(money(1000n, 'BTC'), [PRECIO_USDC, TRM], 'COP')).toBeNull();
  });
});
