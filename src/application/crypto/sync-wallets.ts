import type { BalanceSource, SaldoLeido } from '@/domain/crypto/balance-source';
import type { Chain, Wallet } from '@/domain/crypto/wallet';
import type { WalletRepository } from '@/domain/crypto/wallet-repository';
import { createAccount } from '@/domain/ledger/account';
import { accountId, type AccountId, type OwnerId } from '@/domain/ledger/ids';
import { isZero, type Money } from '@/domain/money/money';

import { registerAdjustment, type LedgerDeps } from '../ledger/register-adjustment';

export interface SyncWalletsDeps extends LedgerDeps {
  /**
   * Una fuente por cadena. Las que no estén, no se leen.
   *
   * El nombre es específico a propósito: `refreshRates` tiene su propia lista
   * de fuentes, y con las dos llamándose `fuentes` en `AppDeps` una pisaría a
   * la otra. El síntoma sería un saldo en cero, que no se distingue de no
   * tener nada.
   */
  fuentesDeSaldo: BalanceSource[];
  /** De dónde sale la lista de wallets. */
  wallets: WalletRepository;
  clock: () => string;
}

export interface ResumenWallets {
  leidas: number;
  /** Cuántos ajustes se asentaron: cero si nada cambió. */
  ajustes: number;
  /** Cadenas que no se pudieron leer. Su saldo se queda como estaba. */
  fallidas: Chain[];
}

/**
 * Por qué se guarda el motivo y no solo «falló»: dentro de una semana, «el nodo
 * no respondió» y «esa dirección no existe» piden cosas distintas.
 */
function motivo(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
 * sería borrar plata de la pantalla. Y cada lectura deja constancia en la
 * wallet —cuándo y si falló—, que es lo que la pantalla necesita para poder
 * decir «no se pudo leer» sin borrar el saldo viejo.
 *
 * Las wallets salen del repositorio, no de un parámetro. Se escribió con la
 * lista por parámetro y no se escribió ningún llamador: el caso de uso quedó
 * probado y sin ejecutarse nunca, y el sprint entero no se veía en el teléfono.
 */
export async function syncWallets(
  deps: SyncWalletsDeps,
  input: { owner: OwnerId },
): Promise<ResumenWallets> {
  const resumen: ResumenWallets = { leidas: 0, ajustes: 0, fallidas: [] };
  const wallets = await deps.wallets.listar(input.owner);

  for (const wallet of wallets) {
    const fuente = deps.fuentesDeSaldo.find((f) => f.chain === wallet.chain);
    if (fuente === undefined) continue;

    let saldos: SaldoLeido[];
    try {
      saldos = await fuente.leerSaldos(wallet);
    } catch (error) {
      // Un fallo en una cadena no impide leer las demás, y no toca su saldo.
      resumen.fallidas.push(wallet.chain);
      await deps.wallets.marcarLectura(wallet.id, deps.clock(), motivo(error));
      continue;
    }
    resumen.leidas += 1;
    await deps.wallets.marcarLectura(wallet.id, deps.clock(), null);

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
