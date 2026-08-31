import type { OwnerId } from '@/domain/ledger/ids';
import type { CurrencyCode } from '@/domain/money/currency';
import { getCurrency } from '@/domain/money/currency';

/** Las cadenas que Sereno sabe consultar. */
export const CHAINS = [
  'ethereum',
  'polygon',
  'arbitrum',
  'base',
  'bsc',
  'optimism',
  'solana',
] as const;

export type Chain = (typeof CHAINS)[number];

export interface TokenSeguido {
  chain: Chain;
  /** Cómo se llama en su cadena. «USDC.e» no es «USDC». */
  simbolo: string;
  /** La moneda del ledger. USDC.e y USDC comparten moneda: valen lo mismo. */
  currency: CurrencyCode;
  /** Dirección del contrato en EVM, o mint en Solana. */
  contrato: string;
  decimales: number;
}

/**
 * Lo que se mira en cada cadena.
 *
 * **Solo USDC y USDT**, que es lo único que David maneja. Una lista larga de
 * tokens que nadie tiene es una lista que nadie mantiene, y cada entrada de
 * más es una petición de más en cada consulta.
 *
 * En Polygon están **los dos USDC**: el nativo de Circle y el puenteado desde
 * Ethereum (`USDC.e`). Son contratos distintos, y el saldo real de David está
 * en el puenteado. Mirar solo el nativo devuelve cero, y **un cero no se
 * distingue de no tener nada**.
 */
export const TOKENS: readonly TokenSeguido[] = [
  {
    chain: 'ethereum',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimales: 6,
  },
  {
    chain: 'ethereum',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimales: 6,
  },
  {
    chain: 'polygon',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    decimales: 6,
  },
  {
    // El puenteado desde Ethereum. Aquí está el saldo real de David.
    chain: 'polygon',
    simbolo: 'USDC.e',
    currency: 'USDC',
    contrato: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    decimales: 6,
  },
  {
    chain: 'polygon',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    decimales: 6,
  },
  {
    chain: 'arbitrum',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimales: 6,
  },
  {
    chain: 'arbitrum',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimales: 6,
  },
  {
    chain: 'base',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimales: 6,
  },
  {
    // En BSC los stablecoins llevan dieciocho decimales, no seis: la escala se
    // declara por token y no se hereda de la moneda.
    chain: 'bsc',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0x55d398326f99059fF775485246999027B3197955',
    decimales: 18,
  },
  {
    chain: 'bsc',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimales: 18,
  },
  {
    chain: 'optimism',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    decimales: 6,
  },
  {
    chain: 'optimism',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    decimales: 6,
  },
  {
    chain: 'solana',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimales: 6,
  },
  {
    chain: 'solana',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimales: 6,
  },
];

export interface Wallet {
  id: string;
  owner: OwnerId;
  chain: Chain;
  /** Pública, siempre. Sereno no conoce ninguna clave privada. */
  direccion: string;
  nombre: string;
}

const EVM = /^0x[0-9a-fA-F]{40}$/;
/** Base58 sin los caracteres ambiguos, entre 32 y 44 de largo. */
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Si la dirección tiene la forma de su cadena.
 *
 * Pegar una dirección EVM donde va una de Solana es buscar plata donde no
 * está, y el resultado —cero— no se distingue de un saldo vacío. Por eso se
 * valida por cadena y no «que parezca una dirección».
 */
export function esDireccionValida(chain: Chain, direccion: string): boolean {
  return chain === 'solana' ? SOLANA.test(direccion) : EVM.test(direccion);
}

/** Los tokens que se miran en una cadena. */
export function tokensDe(chain: Chain): TokenSeguido[] {
  return TOKENS.filter((t) => t.chain === chain);
}

/** Si un token declara una escala que su moneda no puede representar. */
export function escalaCoherente(token: TokenSeguido): boolean {
  const moneda = getCurrency(token.currency);
  return moneda !== undefined && token.decimales >= moneda.scale;
}
