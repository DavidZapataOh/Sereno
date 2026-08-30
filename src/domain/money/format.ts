import { CURRENCIES, type CurrencyCode } from './currency';

/** Signo menos tipográfico (U+2212). Alinea con el más; el guion no. */
const MINUS = '−';
const SEPARADOR_MILES = '.';
const SEPARADOR_DECIMAL = ',';

/**
 * Nombre de cada moneda en español, para leer un monto en voz alta.
 *
 * Es texto de interfaz y no un símbolo, así que no vive en `CURRENCIES`.
 */
const NOMBRES: Record<CurrencyCode, string> = {
  COP: 'pesos',
  USD: 'dólares',
  USDT: 'USDT',
  BTC: 'bitcoin',
  ETH: 'ether',
  SOL: 'SOL',
};

export function currencyName(currency: CurrencyCode): string {
  return NOMBRES[currency];
}

function toBigInt(amount: bigint | number): bigint {
  if (typeof amount === 'bigint') return amount;
  if (!Number.isInteger(amount)) {
    throw new Error(`El monto debe ser entero en la unidad mínima, se recibió: ${String(amount)}`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new Error(`Monto fuera del rango seguro: ${String(amount)}. Usa bigint.`);
  }
  return BigInt(amount);
}

function agruparMiles(digitos: string): string {
  let agrupado = '';
  for (let i = 0; i < digitos.length; i += 1) {
    if (i > 0 && (digitos.length - i) % 3 === 0) agrupado += SEPARADOR_MILES;
    agrupado += digitos.charAt(i);
  }
  return agrupado;
}

export interface FormatOptions {
  withSymbol?: boolean;
}

/**
 * Formatea un monto en la unidad mínima de su moneda, como se escribe en
 * Colombia: punto de miles, coma decimal.
 *
 * No usa `Intl.NumberFormat` a propósito. El formato de un monto no puede
 * depender de la configuración regional del dispositivo: dos usuarios verían
 * cifras distintas para el mismo dato, y las pruebas dependerían del entorno.
 *
 * Trabaja en `bigint` de punta a punta: un saldo en wei desborda `number`, y
 * pasar por él aunque sea un instante pierde dígitos.
 *
 * Devuelve siempre el valor absoluto: el signo lo decide quien llama, según la
 * dirección del dinero, no según el signo del número.
 *
 * Decimales: la moneda fiduciaria los muestra siempre (45,00 y no 45, para que
 * dólares y pesos no se vean iguales); la cripto muestra los que hagan falta y
 * recorta los ceros finales, porque dieciocho ceros no informan de nada.
 */
export function formatAmount(
  amount: bigint | number,
  currency: CurrencyCode,
  options?: FormatOptions,
): string {
  const moneda = CURRENCIES[currency] as (typeof CURRENCIES)[CurrencyCode] | undefined;
  if (moneda === undefined) throw new Error(`Moneda desconocida: ${currency}`);

  const valor = toBigInt(amount);
  const absoluto = valor < 0n ? -valor : valor;
  const digitos = absoluto.toString().padStart(moneda.scale + 1, '0');
  const corte = digitos.length - moneda.scale;
  const entera = agruparMiles(digitos.slice(0, corte));
  let decimal = digitos.slice(corte);

  const esFiduciaria = currency === 'COP' || currency === 'USD';
  if (!esFiduciaria) decimal = decimal.replace(/0+$/, '');

  const numero = decimal.length > 0 ? `${entera}${SEPARADOR_DECIMAL}${decimal}` : entera;
  if (options?.withSymbol !== true) return numero;

  // Un símbolo («$», «₿») va delante; un código alfabético («USDT») va detrás,
  // que es como se lee: «1 USDT», no «USDT 1».
  const esCodigo = /^[A-Z]+$/.test(moneda.symbol);
  return esCodigo ? `${numero} ${moneda.symbol}` : `${moneda.symbol} ${numero}`;
}

/** Atajo para pesos, la moneda de casi todo. */
export function formatCOP(amount: bigint | number, options?: FormatOptions): string {
  return formatAmount(amount, 'COP', options);
}

export type MoneyDirection = 'entra' | 'sale' | 'neutro';

/**
 * Formatea un monto con su signo y símbolo.
 *
 * El cero nunca lleva signo: «−$ 0» sugiere una pérdida que no ocurrió.
 */
export function formatSigned(
  amount: bigint | number,
  direction: MoneyDirection,
  currency: CurrencyCode = 'COP',
): string {
  const base = formatAmount(amount, currency, { withSymbol: true });
  if (toBigInt(amount) === 0n) return base;
  if (direction === 'entra') return `+${base}`;
  if (direction === 'sale') return `${MINUS}${base}`;
  return base;
}
