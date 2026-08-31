import type { Money } from '@/domain/money/money';
import { money } from '@/domain/money/money';
import { getCurrency } from '@/domain/money/currency';

import type { TokenSeguido, Wallet } from './wallet';

export interface SaldoLeido {
  token: TokenSeguido;
  /** En la moneda del ledger, ya reescalado desde la del contrato. */
  cantidad: Money;
  /** Cuándo se leyó. Un saldo sin hora no se puede envejecer. */
  leidoEn: string;
}

/**
 * De dónde salen los saldos de una wallet.
 *
 * Devuelve **todos** los tokens de la cadena, incluidos los que dan cero: un
 * cero es información —«miré y no hay»— y distinguirlo de «no miré» es lo que
 * permite avisar cuando una lectura falla en vez de enseñar un saldo vacío.
 */
export interface BalanceSource {
  chain: TokenSeguido['chain'];
  leerSaldos: (wallet: Wallet) => Promise<SaldoLeido[]>;
}

/**
 * De la escala del contrato a la de la moneda.
 *
 * No son la misma: en BSC los stablecoins llevan dieciocho decimales y en el
 * ledger USDT tiene seis. Tomar el entero del contrato tal cual daría un saldo
 * un billón de veces mayor, y se vería como una fortuna.
 */
export function aMoneda(crudo: bigint, token: TokenSeguido): Money {
  const moneda = getCurrency(token.currency);
  if (moneda === undefined) throw new Error(`Moneda desconocida: ${token.currency}`);

  const sobran = token.decimales - moneda.scale;
  if (sobran < 0) {
    throw new Error(
      `El token ${token.simbolo} declara menos decimales que ${token.currency}: no se puede reescalar sin inventar cifras`,
    );
  }
  // División entera: se trunca, no se redondea. Redondear hacia arriba haría
  // aparecer una unidad mínima que no existe en la cadena.
  return money(crudo / 10n ** BigInt(sobran), token.currency);
}
