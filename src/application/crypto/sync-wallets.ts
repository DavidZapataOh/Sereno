import type { BalanceSource, SaldoLeido } from '@/domain/crypto/balance-source';
import { CADENAS_DE, type Chain, type Wallet } from '@/domain/crypto/wallet';
import type { WalletRepository } from '@/domain/crypto/wallet-repository';
import { accountId, type AccountId, type OwnerId } from '@/domain/ledger/ids';

import { reconcileHolding } from '../ledger/reconcile-holding';
import type { LedgerDeps } from '../ledger/register-adjustment';

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
 * La cuenta del ledger de un token de una wallet en una cadena.
 *
 * Lleva el id de la wallet dentro: sin él, dos direcciones distintas en la
 * misma cadena compartirían cuenta y cada lectura desharía el ajuste de la
 * otra, para siempre.
 */
export function walletAccountId(wallet: Wallet, chain: Chain, simbolo: string): AccountId {
  return accountId(`${wallet.id}:${chain}:${simbolo}`);
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
    const falladas: Chain[] = [];

    // Todas las cadenas de su red. Una dirección EVM vale en las catorce, y
    // mirar solo una deja plata invisible sin que nada lo diga.
    for (const chain of CADENAS_DE[wallet.red]) {
      const fuente = deps.fuentesDeSaldo.find((f) => f.chain === chain);
      if (fuente === undefined) continue;

      let saldos: SaldoLeido[];
      try {
        saldos = await fuente.leerSaldos(wallet);
      } catch {
        // Una cadena caída no impide leer las otras trece, y no toca su saldo.
        resumen.fallidas.push(chain);
        falladas.push(chain);
        continue;
      }
      resumen.leidas += 1;

      await asentarSaldos(deps, input.owner, wallet, chain, saldos, resumen);
    }

    await deps.wallets.marcarLectura(
      wallet.id,
      deps.clock(),
      falladas.length === 0 ? null : `No se pudo leer en: ${falladas.join(', ')}`,
    );
  }

  return resumen;
}

/** Compara lo leído con el ledger y asienta la diferencia. */
async function asentarSaldos(
  deps: SyncWalletsDeps,
  owner: OwnerId,
  wallet: Wallet,
  chain: Chain,
  saldos: SaldoLeido[],
  resumen: ResumenWallets,
): Promise<void> {
  for (const saldo of saldos) {
    // La conciliación es idéntica a la de un exchange —la fuente dice cuánto
    // hay, no qué pasó—, así que vive en un solo sitio.
    const asentado = await reconcileHolding(deps, owner, {
      accountId: walletAccountId(wallet, chain, saldo.token.simbolo),
      nombre: `${saldo.token.simbolo} en ${chain}`,
      currency: saldo.token.currency,
      cantidad: saldo.cantidad,
      leidoEn: saldo.leidoEn,
      motivo: `Saldo leído de ${wallet.nombre} en ${chain}: ${saldo.token.simbolo}`,
    });
    if (asentado) resumen.ajustes += 1;
  }
}
