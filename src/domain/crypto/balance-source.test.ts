import { aMoneda } from './balance-source';
import { tokensDe, type TokenSeguido } from './wallet';

const usdcPolygon = tokensDe('polygon').find((t) => t.simbolo === 'USDC.e') as TokenSeguido;
const usdtBsc = tokensDe('bsc').find((t) => t.simbolo === 'USDT') as TokenSeguido;

describe('aMoneda', () => {
  it('con la misma escala, el entero pasa tal cual', () => {
    // 0,05 USDC.e: el saldo real de Polygon el 2026-08-31.
    expect(aMoneda(50_000n, usdcPolygon)).toEqual({ amount: 50_000n, currency: 'USDC' });
  });

  /**
   * En BSC los stablecoins llevan dieciocho decimales y en el ledger USDT
   * tiene seis. Sin reescalar, un dólar se vería como un billón.
   */
  it('reescala los dieciocho decimales de BSC a los seis de la moneda', () => {
    // 1 USDT en BSC = 10^18 unidades del contrato = 10^6 del ledger.
    expect(aMoneda(1_000_000_000_000_000_000n, usdtBsc).amount).toBe(1_000_000n);
  });

  it('trunca en vez de redondear', () => {
    // Media unidad mínima no existe en la cadena: redondear hacia arriba la
    // haría aparecer.
    expect(aMoneda(1_999_999_999_999n, usdtBsc).amount).toBe(1n);
  });

  it('cero es cero en cualquier escala', () => {
    expect(aMoneda(0n, usdtBsc).amount).toBe(0n);
    expect(aMoneda(0n, usdcPolygon).amount).toBe(0n);
  });

  it('un token con menos decimales que su moneda es un error, no un redondeo', () => {
    const imposible: TokenSeguido = { ...usdcPolygon, decimales: 2 };

    expect(() => aMoneda(100n, imposible)).toThrow(/reescalar/i);
  });

  it('devuelve la moneda del ledger, no el símbolo del token', () => {
    // USDC.e es USDC: el símbolo distingue el contrato, no el valor.
    expect(aMoneda(50_000n, usdcPolygon).currency).toBe('USDC');
  });
});
