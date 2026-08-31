import type { BalanceSource } from '@/domain/crypto/balance-source';
import { CHAINS, type Chain } from '@/domain/crypto/wallet';

import { createEvmBalanceSource } from './evm-balance-source';
import { createSolanaBalanceSource } from './solana-balance-source';

/**
 * Una fuente por cadena, todas las declaradas.
 *
 * Se compone desde `CHAINS` y no con una lista escrita a mano: añadir una
 * cadena al registro y olvidarse de añadirla aquí devolvería cero para ella,
 * y un cero no se distingue de «no tiene nada».
 */
export function createBalanceSources(reloj: () => string): BalanceSource[] {
  return CHAINS.map((chain: Chain) =>
    chain === 'solana'
      ? createSolanaBalanceSource(fetch, reloj)
      : createEvmBalanceSource(chain, fetch, reloj),
  );
}
