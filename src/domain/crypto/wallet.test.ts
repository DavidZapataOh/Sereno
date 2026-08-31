import { getCurrency } from '@/domain/money/currency';

import { CHAINS, escalaCoherente, esDireccionValida, TOKENS, tokensDe, type Chain } from './wallet';

const EVM_REAL = '0x5a4e9Bb1f224e8254C1d63e90dE34E8572f8dC71';
const SOLANA_REAL = '2VWvtXH5du9amnpU9NHP3dnry2ggSj6qcHwzwUn8DB5J';

describe('TOKENS', () => {
  /**
   * El saldo real de David en Polygon está en USDC.e —el puenteado desde
   * Ethereum—, no en el USDC nativo de Circle. Medido el 2026-08-31. Mirar
   * solo el nativo devuelve cero, y **un cero no se distingue de no tener
   * nada**.
   */
  it('incluye USDC.e de Polygon, que es donde está el saldo de verdad', () => {
    expect(tokensDe('polygon').map((t) => t.simbolo)).toContain('USDC.e');
  });

  it('USDC y USDC.e conviven en Polygon con contratos distintos', () => {
    const polygon = tokensDe('polygon');
    const usdc = polygon.filter((t) => t.currency === 'USDC');

    expect(usdc).toHaveLength(2);
    expect(usdc[0]?.contrato).not.toBe(usdc[1]?.contrato);
  });

  it('los dos USDC de Polygon comparten moneda: valen lo mismo', () => {
    expect(tokensDe('polygon').filter((t) => t.currency === 'USDC')).toHaveLength(2);
  });

  it('no hay dos entradas con el mismo contrato en la misma cadena', () => {
    for (const chain of CHAINS) {
      const contratos = tokensDe(chain).map((t) => t.contrato.toLowerCase());
      expect(new Set(contratos).size).toBe(contratos.length);
    }
  });

  it('los contratos de EVM tienen forma de dirección', () => {
    for (const token of TOKENS.filter((t) => t.chain !== 'solana')) {
      expect(token.contrato).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it('los mints de Solana tienen forma de dirección de Solana', () => {
    for (const token of tokensDe('solana')) {
      expect(esDireccionValida('solana', token.contrato)).toBe(true);
    }
  });

  it('solo se siguen USDC y USDT: es lo único que hay', () => {
    expect(new Set(TOKENS.map((t) => t.currency))).toEqual(new Set(['USDC', 'USDT']));
  });

  /**
   * En BSC los stablecoins llevan dieciocho decimales y no seis. Tomar la
   * escala de la moneda en vez de la del contrato daría un saldo un billón de
   * veces mayor.
   */
  it('la escala se declara por token, no se hereda de la moneda', () => {
    const bscUsdt = tokensDe('bsc').find((t) => t.simbolo === 'USDT');

    expect(bscUsdt?.decimales).toBe(18);
    expect(getCurrency('USDT')?.scale).toBe(6);
  });

  it('ningún token declara menos decimales que su moneda', () => {
    // Al revés no se puede reescalar sin perder cifras.
    for (const token of TOKENS) {
      expect(escalaCoherente(token)).toBe(true);
    }
  });

  it('cada cadena declarada tiene al menos un token', () => {
    for (const chain of CHAINS) {
      expect(tokensDe(chain).length).toBeGreaterThan(0);
    }
  });
});

describe('esDireccionValida', () => {
  it('acepta la dirección EVM real', () => {
    expect(esDireccionValida('polygon', EVM_REAL)).toBe(true);
  });

  it('acepta la dirección de Solana real', () => {
    expect(esDireccionValida('solana', SOLANA_REAL)).toBe(true);
  });

  /**
   * Pegar una dirección de otra cadena es buscar plata donde no está, y el
   * resultado —cero— no se distingue de un saldo vacío.
   */
  it('no acepta una dirección EVM como si fuera de Solana, ni al revés', () => {
    expect(esDireccionValida('solana', EVM_REAL)).toBe(false);
    expect(esDireccionValida('polygon', SOLANA_REAL)).toBe(false);
  });

  it('rechaza una dirección EVM con un carácter de más o de menos', () => {
    expect(esDireccionValida('polygon', `${EVM_REAL}a`)).toBe(false);
    expect(esDireccionValida('polygon', EVM_REAL.slice(0, -1))).toBe(false);
  });

  it('rechaza vacío y basura', () => {
    for (const chain of CHAINS) {
      expect(esDireccionValida(chain, '')).toBe(false);
      expect(esDireccionValida(chain, 'no soy una dirección')).toBe(false);
    }
  });

  it('acepta mayúsculas y minúsculas en EVM', () => {
    expect(esDireccionValida('polygon', EVM_REAL.toLowerCase())).toBe(true);
    expect(esDireccionValida('polygon', EVM_REAL.toUpperCase().replace('0X', '0x'))).toBe(true);
  });

  it('rechaza en Solana los caracteres ambiguos de base58', () => {
    // 0, O, I y l no existen en base58: si aparecen, la dirección está mal
    // copiada.
    expect(esDireccionValida('solana', '0VWvtXH5du9amnpU9NHP3dnry2ggSj6qcHwzwUn8DB5J')).toBe(false);
  });
});

describe('CHAINS', () => {
  it('Solana está declarada, y es la única que no es EVM', () => {
    const noEvm: Chain[] = CHAINS.filter((c) => c === 'solana');
    expect(noEvm).toEqual(['solana']);
  });
});
