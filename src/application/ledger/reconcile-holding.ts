import { createAccount } from '@/domain/ledger/account';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import type { CurrencyCode } from '@/domain/money/currency';
import { isZero, type Money } from '@/domain/money/money';

import { registerAdjustment, type LedgerDeps } from './register-adjustment';

/** Un saldo completo leído de fuera, listo para comparar con el ledger. */
export interface SaldoExterno {
  accountId: AccountId;
  /** Cómo se llama la cuenta si hay que crearla. */
  nombre: string;
  currency: CurrencyCode;
  cantidad: Money;
  /** Cuándo se leyó. La fecha del ajuste, si hace falta uno. */
  leidoEn: string;
  /** Qué se escribe en el ajuste. Dentro de un mes, «ajuste» no dice nada. */
  motivo: string;
}

/**
 * Deja en el ledger un saldo que se leyó completo de fuera.
 *
 * Es el mismo problema para una wallet on-chain y para un exchange, y por eso
 * vive aquí y no en cada uno: la fuente dice **cuánto hay**, no qué pasó, así
 * que se compara con lo que dice el ledger y se asienta la diferencia contra
 * Ajustes. No hace falta declarar un punto de partida —la lectura ya trae todo
 * lo que hay—, que es la diferencia con las cuentas de banco del sprint 04.
 *
 * **Un saldo en cero que nunca tuvo nada no crea cuenta.** Entre catorce
 * cadenas y un exchange serían decenas de cuentas vacías, y una lista llena de
 * ceros esconde lo que importa. Pero la que tuvo saldo y baja a cero **se
 * queda** en cero: eso es historia, no ruido.
 *
 * Devuelve si asentó algo.
 */
export async function reconcileHolding(
  deps: LedgerDeps,
  owner: OwnerId,
  saldo: SaldoExterno,
): Promise<boolean> {
  const cuenta = await deps.accounts.findById(saldo.accountId);
  if (cuenta === null && isZero(saldo.cantidad)) return false;

  if (cuenta === null) {
    await deps.accounts.save(
      createAccount({
        id: saldo.accountId,
        owner,
        kind: 'activo',
        nombre: saldo.nombre,
        currency: saldo.currency,
      }),
    );
  }

  const actual = await deps.accounts.balanceOf(saldo.accountId);
  const diferencia: Money = {
    amount: saldo.cantidad.amount - actual.amount,
    currency: saldo.cantidad.currency,
  };
  if (isZero(diferencia)) return false;

  // La fuente dice **cuánto** hay, no **por qué** cambió: la contrapartida va
  // a Ajustes, igual que el conteo de efectivo. Saber la causa exigiría leer
  // los movimientos de la fuente, y eso es otro problema.
  await registerAdjustment(deps, {
    owner,
    accountId: saldo.accountId,
    amount: diferencia,
    motivo: saldo.motivo,
    fecha: saldo.leidoEn,
  });
  return true;
}
