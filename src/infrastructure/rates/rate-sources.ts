import type { FuenteDeTasas } from '@/application/rates/refresh-rates';

import { createStablecoinSource } from './stablecoin-source';
import { createTrmSource } from './trm-source';

/**
 * Los pares que hacen falta para valorar lo que hay.
 *
 * USD→COP sale de la TRM oficial; USDC→USD y USDT→USD del precio de mercado.
 * Encadenar los dos es lo que da el peso: una stablecoin no vale un dólar por
 * definición, y darlo por hecho mete un error silencioso en el patrimonio.
 */
export function createRateSources(reloj: () => string): FuenteDeTasas[] {
  const trm = createTrmSource();
  const stablecoins = createStablecoinSource(fetch, reloj);

  return [
    { par: { desde: 'USD', hacia: 'COP' }, leer: () => trm.ultima() },
    { par: { desde: 'USDC', hacia: 'USD' }, leer: () => stablecoins.precio('USDC') },
    { par: { desde: 'USDT', hacia: 'USD' }, leer: () => stablecoins.precio('USDT') },
  ];
}
