import type { BalanceSource, SaldoLeido } from '@/domain/crypto/balance-source';
import type { Chain, Wallet } from '@/domain/crypto/wallet';
import { createAccount } from '@/domain/ledger/account';
import { accountId, type AccountId, type OwnerId } from '@/domain/ledger/ids';
import { isZero, type Money } from '@/domain/money/money';

import { registerAdjustment, type LedgerDeps } from '../ledger/register-adjustment';

export interface SyncWalletsDeps extends LedgerDeps {
  /** Una fuente por cadena. Las que no estén, no se leen. */
  fuentes: BalanceSource[];
}

export interface ResumenWallets {
  leidas: number;
  /** Cuántos ajustes se asentaron: cero si nada cambió. */
  ajustes: number;
  /** Cadenas que no se pudieron leer. Su saldo se queda como estaba. */
  fallidas: Chain[];
}

/** La cuenta del ledger de un token en una wallet. */
export function walletAccountId(wallet: Wallet, simbolo: string): AccountId {
  return accountId(`wallet:${wallet.chain}:${simbolo}`);
}

/**
 * Lee los saldos de las wallets y los deja en el ledger.
 *
 * Aquí **no hace falta declarar un punto de partida**. Es la diferencia con
 * las cuentas de banco y con las tarjetas del sprint 07: la cadena devuelve el
 * saldo completo cada vez, no una lista de movimientos, así que la primera
 * lectura ya trae todo lo que hay.
 *
 * Lo que sí importa es no confundir «no tienes nada» con «no pude mirar». Una
 * cadena que falla deja su saldo intacto y aparece en `fallidas`; poner cero
 * sería borrar plata de la pantalla.
 */
export async function syncWallets(
  deps: SyncWalletsDeps,
  input: { owner: OwnerId; wallets: Wallet[] },
): Promise<ResumenWallets> {
  const resumen: ResumenWallets = { leidas: 0, ajustes: 0, fallidas: [] };

  for (const wallet of input.wallets) {
    const fuente = deps.fuentes.find((f) => f.chain === wallet.chain);
    if (fuente === undefined) continue;

    let saldos: SaldoLeido[];
    try {
      saldos = await fuente.leerSaldos(wallet);
    } catch {
      // Un fallo en una cadena no impide leer las demás, y no toca su saldo.
      resumen.fallidas.push(wallet.chain);
      continue;
    }
    resumen.leidas += 1;

    for (const saldo of saldos) {
      const id = walletAccountId(wallet, saldo.token.simbolo);
      await asegurarCuenta(deps, input.owner, wallet, saldo, id);

      const actual = await deps.accounts.balanceOf(id);
      const diferencia: Money = {
        amount: saldo.cantidad.amount - actual.amount,
        currency: saldo.cantidad.currency,
      };
      if (isZero(diferencia)) continue;

      // La cadena dice **cuánto** hay, no **por qué** cambió: la contrapartida
      // va a Ajustes, igual que el conteo de efectivo. Saber la causa exigiría
      // leer las transferencias on-chain, y eso no es de este sprint.
      await registerAdjustment(deps, {
        owner: input.owner,
        accountId: id,
        amount: diferencia,
        motivo: `Saldo leído de ${wallet.nombre}: ${saldo.token.simbolo}`,
        fecha: saldo.leidoEn,
      });
      resumen.ajustes += 1;
    }
  }

  return resumen;
}

/** La cuenta de un token existe o se crea. Idempotente. */
async function asegurarCuenta(
  deps: SyncWalletsDeps,
  owner: OwnerId,
  wallet: Wallet,
  saldo: SaldoLeido,
  id: AccountId,
): Promise<void> {
  if ((await deps.accounts.findById(id)) !== null) return;
  await deps.accounts.save(
    createAccount({
      id,
      owner,
      kind: 'activo',
      nombre: `${saldo.token.simbolo} en ${wallet.nombre}`,
      currency: saldo.token.currency,
    }),
  );
}
