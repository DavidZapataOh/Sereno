import type { ExchangeStatus, ServerClient } from '@/domain/sync/server-client';
import { accountId, type AccountId, type OwnerId } from '@/domain/ledger/ids';
import { getCurrency, type CurrencyCode } from '@/domain/money/currency';
import { money } from '@/domain/money/money';

import { reconcileHolding } from '../ledger/reconcile-holding';
import type { LedgerDeps } from '../ledger/register-adjustment';

export interface SyncExchangeDeps extends LedgerDeps {
  servidor: ServerClient;
}

export interface ResumenExchange {
  /** El estado de la lectura, tal cual: se enseña en Ajustes. */
  estado: ExchangeStatus['estado'];
  leidos: number;
  ajustes: number;
  /** Por qué no se pudo leer, o `null` si no falló. */
  error: string | null;
}

/** La cuenta del ledger de un activo en el exchange. */
export function exchangeAccountId(activo: string): AccountId {
  return accountId(`binance:${activo}`);
}

/**
 * Trae los saldos de Binance del servidor y los deja en el ledger.
 *
 * **Es el mismo caso que las wallets con otra fuente**, así que comparte con
 * ellas la conciliación (`reconcileHolding`): el exchange dice cuánto hay, no
 * qué pasó, y la diferencia se asienta contra Ajustes.
 *
 * Las claves están en el servidor y no aquí, igual que la contraseña del
 * correo desde el sprint 06: el teléfono no guarda credenciales que toquen
 * dinero.
 *
 * Si la lectura falla, **no se toca ningún saldo**. Poner cero sería confundir
 * «no tienes nada» con «no pude mirar», y borrar plata de la pantalla.
 */
export async function syncExchange(
  deps: SyncExchangeDeps,
  input: { owner: OwnerId },
): Promise<ResumenExchange> {
  const leidoEn = deps.clock();
  const respuesta = await deps.servidor.saldos();

  // Los tres casos, explícitos. Antes esto era un `catch` que se tragaba el
  // error: las claves no estaban en Railway y la app no dijo nada.
  if (respuesta.estado !== 'ok') {
    return {
      estado: respuesta.estado,
      leidos: 0,
      ajustes: 0,
      error: respuesta.estado === 'error' ? respuesta.motivo : null,
    };
  }

  const resumen: ResumenExchange = { estado: 'ok', leidos: 0, ajustes: 0, error: null };

  for (const saldo of respuesta.saldos) {
    const currency = monedaDe(saldo.activo);
    // Un activo que el ledger no sabe representar se salta en vez de
    // inventarle una escala: una escala mal puesta multiplica el saldo.
    if (currency === null) continue;
    resumen.leidos += 1;

    const asentado = await reconcileHolding(deps, input.owner, {
      accountId: exchangeAccountId(saldo.activo),
      nombre: `${saldo.activo} en Binance`,
      currency,
      cantidad: money(BigInt(saldo.cantidad), currency),
      leidoEn,
      motivo: `Saldo leído de Binance: ${saldo.activo}`,
    });
    if (asentado) resumen.ajustes += 1;
  }

  return resumen;
}

/** Binance llama a los activos como el ledger llama a las monedas, o no existe. */
function monedaDe(activo: string): CurrencyCode | null {
  const codigo = activo as CurrencyCode;
  return getCurrency(codigo) === undefined ? null : codigo;
}
