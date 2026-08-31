import type { OwnerId } from '@/domain/ledger/ids';
import type { CurrencyCode } from '@/domain/money/currency';
import { getCurrency } from '@/domain/money/currency';

/**
 * Las cadenas que Sereno sabe consultar.
 *
 * Catorce EVM y Solana. Se miran **todas** en cada lectura: una dirección EVM
 * es la misma en todas las cadenas EVM, así que preguntarle al usuario en cuál
 * mirar es pedirle que adivine dónde está su propia plata. Si un día tiene algo
 * en Scroll y nadie lo miró, no hay ningún aviso: solo un saldo que falta.
 */
export const CADENAS_EVM = [
  'ethereum',
  'polygon',
  'arbitrum',
  'base',
  'bsc',
  'optimism',
  'avalanche',
  'linea',
  'scroll',
  'gnosis',
  'celo',
  'zksync',
  'mantle',
  'sonic',
] as const;

export const CHAINS = [...CADENAS_EVM, 'solana'] as const;

export type Chain = (typeof CHAINS)[number];
export type ChainEvm = (typeof CADENAS_EVM)[number];

/**
 * La red de una wallet, que es lo que de verdad la define.
 *
 * No es la cadena: una dirección EVM vale en las catorce, y una de Solana solo
 * en la suya.
 */
export type Red = 'evm' | 'solana';

export const CADENAS_DE: Record<Red, readonly Chain[]> = {
  evm: CADENAS_EVM,
  solana: ['solana'],
};

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
 * **Solo USDC y USDT**, que es lo único que David maneja —pero en **todas** las
 * cadenas donde existen—. Un token de más es una petición de más; una cadena de
 * menos es plata que no se ve y de la que nadie avisa, y eso es mucho peor.
 *
 * Cada contrato de aquí se comprobó llamando a `symbol()` y `decimals()` en su
 * propia cadena. No es ceremonia: un contrato mal copiado **responde cero sin
 * quejarse**, y un cero no se distingue de no tener nada. Al verificarlos
 * aparecieron dos cosas que no se sabían: en Gnosis el contrato es `USDC.e`, y
 * en BSC los stablecoins llevan dieciocho decimales.
 *
 * **Blast queda fuera** a propósito: su stablecoin es `USDB`, otra moneda, sin
 * fuente de precio. Añadirla metería un saldo que no se puede valorar.
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
    chain: 'base',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    decimales: 6,
  },
  {
    chain: 'avalanche',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    decimales: 6,
  },
  {
    chain: 'avalanche',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    decimales: 6,
  },
  {
    chain: 'linea',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
    decimales: 6,
  },
  {
    chain: 'linea',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0xA219439258ca9da29E9Cc4cE5596924745e12B93',
    decimales: 6,
  },
  {
    chain: 'scroll',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
    decimales: 6,
  },
  {
    chain: 'scroll',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df',
    decimales: 6,
  },
  {
    // El contrato dice «USDC.e», no «USDC»: es el puenteado. Se etiqueta como
    // lo que es, que para eso se comprobó contra la cadena.
    chain: 'gnosis',
    simbolo: 'USDC.e',
    currency: 'USDC',
    contrato: '0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0',
    decimales: 6,
  },
  {
    chain: 'celo',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    decimales: 6,
  },
  {
    chain: 'zksync',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4',
    decimales: 6,
  },
  {
    chain: 'zksync',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C',
    decimales: 6,
  },
  {
    chain: 'mantle',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
    decimales: 6,
  },
  {
    chain: 'mantle',
    simbolo: 'USDT',
    currency: 'USDT',
    contrato: '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE',
    decimales: 6,
  },
  {
    chain: 'sonic',
    simbolo: 'USDC',
    currency: 'USDC',
    contrato: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
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
  /**
   * La red, no la cadena. Una wallet EVM se lee en las catorce cadenas EVM con
   * la misma dirección.
   */
  red: Red;
  /** Pública, siempre. Sereno no conoce ninguna clave privada. */
  direccion: string;
  nombre: string;
}

const EVM = /^0x[0-9a-fA-F]{40}$/;
/** Base58 sin los caracteres ambiguos, entre 32 y 44 de largo. */
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * De qué red es una dirección, deducido de su forma.
 *
 * Se deduce en vez de preguntarse. Elegir la red es una decisión que el usuario
 * no tiene por qué tomar —y en la que se puede equivocar sin enterarse: una
 * dirección buena en la red equivocada devuelve cero, y un cero no se distingue
 * de un saldo vacío—.
 *
 * `null` para lo que no es ninguna de las dos. Una clave privada, por ejemplo,
 * tiene 64 hex y no 40: no es dirección de nada, y así se rechaza sola.
 */
export function redDe(direccion: string): Red | null {
  const limpia = direccion.trim();
  if (EVM.test(limpia)) return 'evm';
  if (SOLANA.test(limpia)) return 'solana';
  return null;
}

/** Si la dirección tiene la forma que su red exige. */
export function esDireccionValida(red: Red, direccion: string): boolean {
  return redDe(direccion) === red;
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
