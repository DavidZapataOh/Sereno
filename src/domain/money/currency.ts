export type CurrencyCode = 'COP' | 'USD' | 'USDC' | 'USDT' | 'BTC' | 'ETH' | 'SOL';

export interface Currency {
  code: CurrencyCode;
  /** Decimales de la unidad mínima. El peso no usa; ether usa dieciocho. */
  scale: number;
  symbol: string;
}

/**
 * Monedas que el sistema conoce.
 *
 * La escala se declara por moneda y nunca se asume. Tratar un satoshi como si
 * fuera un centavo es un error de ocho órdenes de magnitud.
 */
export const CURRENCIES: Record<CurrencyCode, Currency> = {
  COP: { code: 'COP', scale: 0, symbol: '$' },
  USD: { code: 'USD', scale: 2, symbol: 'US$' },
  // Seis decimales, igual que USDT: es lo que declaran los dos contratos.
  // Es lo que David tiene de verdad —USDC.e en Polygon y USDC en Solana—, y
  // faltaba en el registro.
  USDC: { code: 'USDC', scale: 6, symbol: 'USDC' },
  USDT: { code: 'USDT', scale: 6, symbol: 'USDT' },
  BTC: { code: 'BTC', scale: 8, symbol: '₿' },
  ETH: { code: 'ETH', scale: 18, symbol: 'Ξ' },
  SOL: { code: 'SOL', scale: 9, symbol: 'SOL' },
};

export function getCurrency(code: string): Currency | undefined {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code)
    ? CURRENCIES[code as CurrencyCode]
    : undefined;
}
