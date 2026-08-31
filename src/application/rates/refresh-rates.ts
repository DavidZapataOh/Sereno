import type { CurrencyCode } from '@/domain/money/currency';
import type { Rate } from '@/domain/rates/rate';
import type { RateRepository } from '@/domain/rates/rate-repository';

export interface FuenteDeTasas {
  /** Un par y de dónde sale su tasa. */
  par: { desde: CurrencyCode; hacia: CurrencyCode };
  leer: () => Promise<Rate>;
}

export interface RefreshRatesDeps {
  rates: RateRepository;
  fuentes: FuenteDeTasas[];
  clock: () => string;
}

export interface ResumenTasas {
  pedidas: number;
  guardadas: number;
  /** Los pares que no se pudieron leer. Su última tasa sigue sirviendo. */
  fallidos: string[];
}

/**
 * Cada cuánto vale la pena volver a preguntar.
 *
 * La TRM cambia una vez al día y el precio de una stablecoin se mueve en la
 * cuarta cifra decimal: pedirlos en cada arranque es maltratar dos APIs
 * públicas y gratuitas para no enterarse de nada.
 */
const FRESCURA_MS = 60 * 60 * 1000;

/**
 * Trae las tasas que hagan falta y las guarda.
 *
 * Un fallo **no borra la última conocida**: valorar con una tasa de ayer,
 * diciendo que es de ayer, es mucho mejor que no valorar.
 */
export async function refreshRates(
  deps: RefreshRatesDeps,
  input: { forzar?: boolean } = {},
): Promise<ResumenTasas> {
  const resumen: ResumenTasas = { pedidas: 0, guardadas: 0, fallidos: [] };
  const ahora = Date.parse(deps.clock());

  for (const fuente of deps.fuentes) {
    const nombre = `${fuente.par.desde}->${fuente.par.hacia}`;
    if (input.forzar !== true) {
      const ultima = await deps.rates.ultima(fuente.par.desde, fuente.par.hacia);
      if (ultima !== null && ahora - Date.parse(ultima.momento) < FRESCURA_MS) continue;
    }

    resumen.pedidas += 1;
    try {
      await deps.rates.guardar(await fuente.leer());
      resumen.guardadas += 1;
    } catch {
      // La última conocida sigue en la base: no se toca.
      resumen.fallidos.push(nombre);
    }
  }

  return resumen;
}
