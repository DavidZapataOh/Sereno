import type { CurrencyCode } from '@/domain/money/currency';
import { rate, type Rate } from '@/domain/rates/rate';

import { aEnteroConEscala, type Fetch } from './trm-source';

/**
 * El precio de una stablecoin en dólares.
 *
 * Se **lee**, no se supone. Un USDC vale «un dólar», pero no exactamente:
 * medido el 2026-08-31 estaba en 1,00018. Con los saldos actuales la
 * diferencia es de céntimos de peso y da igual; con mil dólares no, y volver
 * aquí entonces costaría más que hacerlo ahora.
 *
 * La respuesta real de Binance, comprobada el mismo día:
 *
 *     { "symbol": "USDCUSDT", "price": "1.00018000" }
 *
 * Es el endpoint público: no necesita clave. La integración con clave del plan
 * 01 es para los saldos, no para esto.
 */
const URL_PRECIO = 'https://api.binance.com/api/v3/ticker/price';

const ESCALA = 8;
/** Uno exacto, en la escala de arriba. El respaldo cuando no hay fuente. */
const UNO = 10n ** BigInt(ESCALA);

/**
 * Cuánto puede alejarse de un dólar antes de ser una respuesta rota.
 *
 * Una stablecoin a 3 dólares no es una oportunidad: es un dato corrupto, y
 * aceptarlo multiplicaría el patrimonio por tres. Un 10 % deja sitio a un
 * susto de mercado real y descarta lo absurdo.
 */
const MINIMO = (UNO * 90n) / 100n;
const MAXIMO = (UNO * 110n) / 100n;

/** Con qué par se pregunta cada moneda. */
const PARES: Partial<Record<CurrencyCode, string>> = {
  USDC: 'USDCUSDT',
};

interface RespuestaPrecio {
  symbol?: string;
  price?: string;
}

export function createStablecoinSource(
  hacerFetch: Fetch = fetch,
  ahora: () => string = () => new Date().toISOString(),
) {
  return {
    /**
     * El precio en dólares de una stablecoin.
     *
     * Si no hay fuente, devuelve uno a uno **marcado como aproximado**: la
     * interfaz lo enseña como tal, y así la suposición nunca queda sin
     * declarar.
     */
    precio: async (currency: CurrencyCode): Promise<Rate> => {
      const par = PARES[currency];
      const momento = ahora();
      const aproximado = (): Rate =>
        rate({
          desde: currency,
          hacia: 'USD',
          valor: UNO,
          escala: ESCALA,
          origen: 'aproximado 1:1',
          momento,
        });

      // USDT es la referencia del par: preguntar su precio contra sí mismo no
      // significa nada.
      if (par === undefined) return aproximado();

      try {
        const respuesta = await hacerFetch(`${URL_PRECIO}?symbol=${par}`, {
          signal: AbortSignal.timeout(15_000),
        });
        const cuerpo = (await respuesta.json()) as RespuestaPrecio;
        if (cuerpo.price === undefined) return aproximado();

        const valor = aEnteroConEscala(cuerpo.price, ESCALA);
        if (valor < MINIMO || valor > MAXIMO) {
          throw new Error(
            `${currency} vino a ${cuerpo.price} dólares: eso no es una stablecoin, es una respuesta rota`,
          );
        }

        return rate({
          desde: currency,
          hacia: 'USD',
          valor,
          escala: ESCALA,
          origen: 'Binance',
          momento,
        });
      } catch (error) {
        // Un precio absurdo sí sube: es un dato corrupto, no una fuente caída.
        if (error instanceof Error && error.message.includes('respuesta rota')) throw error;
        return aproximado();
      }
    },
  };
}
