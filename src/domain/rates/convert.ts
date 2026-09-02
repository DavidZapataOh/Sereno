import { getCurrency, type CurrencyCode } from '@/domain/money/currency';
import { money, type Money } from '@/domain/money/money';

import type { Rate } from './rate';

/**
 * Convierte un monto con una tasa, sin pasar por coma flotante en ningún paso.
 *
 * Las tres escalas en juego —la del monto, la de la tasa y la de la moneda de
 * destino— se combinan con enteros. Un `Number` en medio bastaría para que un
 * saldo en satoshis perdiera cifras sin que nadie lo notara.
 */
export function convertir(monto: Money, tasa: Rate): Money {
  if (monto.currency !== tasa.desde) {
    throw new Error(
      `La tasa va de ${tasa.desde} a ${tasa.hacia} y el monto está en ${monto.currency}: moneda distinta`,
    );
  }
  const origen = getCurrency(monto.currency);
  const destino = getCurrency(tasa.hacia);
  if (origen === undefined || destino === undefined) {
    throw new Error('Moneda desconocida en la conversión');
  }

  // valor_destino = monto * tasa * 10^(escala_destino) / (10^escala_tasa * 10^escala_origen)
  const numerador = monto.amount * tasa.valor * 10n ** BigInt(destino.scale);
  const denominador = 10n ** BigInt(tasa.escala + origen.scale);
  return money(numerador / denominador, tasa.hacia);
}

/**
 * Compone dos tasas en una: `A→B` y `B→C` dan `A→C`.
 *
 * Componer y convertir una vez **no** es lo mismo que convertir dos veces. Al
 * convertir en cada paso, el resultado intermedio se trunca a la escala de esa
 * moneda: 0,085761 USDC pasan por 0,08 USD —el dólar solo tiene dos
 * decimales— y llegan a 256 pesos en vez de 274. Componer mantiene todas las
 * cifras hasta el final.
 */
function componer(a: Rate, b: Rate): Rate {
  if (a.hacia !== b.desde) {
    throw new Error(`No se pueden componer ${a.desde}→${a.hacia} con ${b.desde}→${b.hacia}`);
  }
  return {
    desde: a.desde,
    hacia: b.hacia,
    valor: a.valor * b.valor,
    escala: a.escala + b.escala,
    origen: `${a.origen} × ${b.origen}`,
    // La más vieja de las dos: una cadena vale lo que su eslabón más antiguo.
    momento: a.momento < b.momento ? a.momento : b.momento,
  };
}

/**
 * La tasa que lleva de una moneda a otra, componiendo las que haya.
 *
 * Devuelve la tasa y no el monto convertido para que quien llame pueda
 * enseñarla: «de cuándo es» y «de dónde salió» son parte de la respuesta.
 */
export function tasaHasta(
  desde: CurrencyCode,
  hacia: CurrencyCode,
  tasas: readonly Rate[],
): Rate | null {
  if (desde === hacia) return null;

  // Búsqueda en anchura: son dos o tres tasas, no hay nada que optimizar, y
  // así da igual en qué orden lleguen.
  const visitadas = new Set<CurrencyCode>([desde]);
  let frontera: Rate[] = tasas.filter((t) => t.desde === desde);

  const directa = frontera.find((t) => t.hacia === hacia);
  if (directa !== undefined) return directa;

  for (let salto = 0; salto < tasas.length; salto += 1) {
    const siguiente: Rate[] = [];
    for (const acumulada of frontera) {
      visitadas.add(acumulada.hacia);
      for (const tasa of tasas) {
        if (tasa.desde !== acumulada.hacia || visitadas.has(tasa.hacia)) continue;
        const compuesta = componer(acumulada, tasa);
        if (compuesta.hacia === hacia) return compuesta;
        siguiente.push(compuesta);
      }
    }
    if (siguiente.length === 0) break;
    frontera = siguiente;
  }
  return null;
}

/**
 * Encadena las tasas necesarias y convierte **una sola vez**.
 *
 * Si falta algún eslabón devuelve `null` y **no inventa el resto**: un cero
 * aquí se sumaría al patrimonio como si el saldo no valiera nada.
 */
export function cadena(monto: Money, tasas: readonly Rate[], hacia: CurrencyCode): Money | null {
  if (monto.currency === hacia) return monto;
  const tasa = tasaHasta(monto.currency, hacia, tasas);
  return tasa === null ? null : convertir(monto, tasa);
}
