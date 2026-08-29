import type { CurrencyCode } from './currency';

/**
 * Un monto de dinero.
 *
 * `amount` es un entero en la unidad mínima de la moneda, como `bigint`: los
 * saldos en wei o satoshis desbordan `number` sin avisar. La escala vive en la
 * moneda, no aquí, para que dos montos de la misma moneda siempre sean
 * comparables sin normalizar.
 */
export interface Money {
  readonly amount: bigint;
  readonly currency: CurrencyCode;
}

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`No se pueden operar montos de monedas distintas: ${a} y ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

export function money(amount: bigint | number, currency: CurrencyCode): Money {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) {
      throw new Error(`Monto no finito: ${String(amount)}`);
    }
    if (!Number.isInteger(amount)) {
      throw new Error(`El monto debe ser entero, se recibió: ${String(amount)}`);
    }
    if (!Number.isSafeInteger(amount)) {
      throw new Error(`Monto fuera del rango seguro: ${String(amount)}. Usa bigint.`);
    }
    return { amount: BigInt(amount), currency };
  }
  return { amount, currency };
}

export function zero(currency: CurrencyCode): Money {
  return { amount: 0n, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function negate(a: Money): Money {
  return { amount: -a.amount, currency: a.currency };
}

export function absolute(a: Money): Money {
  return { amount: a.amount < 0n ? -a.amount : a.amount, currency: a.currency };
}

export function isZero(a: Money): boolean {
  return a.amount === 0n;
}

export function isNegative(a: Money): boolean {
  return a.amount < 0n;
}

/**
 * Multiplica por una fracción exacta.
 *
 * La fracción se pasa como numerador y denominador enteros en vez de un float:
 * `0.335` no existe exactamente en binario, y multiplicar por él introduce el
 * error que todo esto quiere evitar.
 *
 * Trunca hacia cero. El resto se maneja con `allocate`, no aquí.
 */
export function multiply(a: Money, factor: { numerator: bigint; denominator: bigint }): Money {
  if (factor.denominator === 0n) throw new Error('El denominador no puede ser cero');
  return { amount: (a.amount * factor.numerator) / factor.denominator, currency: a.currency };
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amount < b.amount) return -1;
  if (a.amount > b.amount) return 1;
  return 0;
}

export function sum(values: Money[], currency: CurrencyCode): Money {
  return values.reduce<Money>((acc, value) => add(acc, value), zero(currency));
}

/**
 * Reparte un monto entre varias partes según proporciones.
 *
 * Es la operación que hace posible una compra a cuotas honesta: dividir
 * 1.000.000 entre 12 da 83.333,33, que no existe en pesos. `allocate` reparte
 * 83.334 a las primeras cuatro y 83.333 a las demás, de forma que la suma sea
 * exactamente 1.000.000.
 *
 * Redondear cada cuota por separado produciría una diferencia que aparece meses
 * después como una deuda que no cuadra.
 */
export function allocate(a: Money, ratios: number[]): Money[] {
  if (ratios.length === 0) throw new Error('Se requiere al menos una proporción');
  if (ratios.some((ratio) => ratio < 0)) {
    throw new Error('Las proporciones no pueden ser negativas');
  }

  const total = ratios.reduce((acc, ratio) => acc + ratio, 0);
  if (total === 0) throw new Error('Las proporciones no pueden sumar cero');

  const negativo = a.amount < 0n;
  const magnitud = negativo ? -a.amount : a.amount;
  const totalBig = BigInt(total);

  const cuotas = ratios.map((ratio) => ({
    ratio,
    parte: (magnitud * BigInt(ratio)) / totalBig,
  }));
  let resto = magnitud - cuotas.reduce((acc, cuota) => acc + cuota.parte, 0n);

  // Cada división trunca hacia abajo, así que el resto es siempre MENOR que el
  // número de cuotas con proporción positiva. Por eso basta una sola pasada
  // dando una unidad a cada una: no hace falta dar vueltas al arreglo.
  return cuotas.map(({ ratio, parte }) => {
    const recibeUnidad = resto > 0n && ratio > 0;
    if (recibeUnidad) resto -= 1n;
    const ajustada = recibeUnidad ? parte + 1n : parte;
    return { amount: negativo ? -ajustada : ajustada, currency: a.currency };
  });
}
