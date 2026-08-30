import type { Capture } from '@/domain/capture/reassembler';
import { summarizeSession } from '@/domain/capture/session-summary';
import type { OwnerId } from '@/domain/ledger/ids';
import { sourceAccountId } from '@/domain/ledger/system-accounts';
import { money } from '@/domain/money/money';
import type { PortalId } from '@/domain/portals/registry';
import type { Reconciliation } from '@/domain/reconciliation/reconciliation';

import { reconcileAccount, type ReconciliationDeps } from './reconcile-account';

export type { ReconciliationDeps } from './reconcile-account';

/**
 * Concilia con lo que el portal declaró en la misma sesión que trajo los
 * movimientos. Se usa la captura de saldos más reciente y su instante como
 * fecha de conciliación: es el momento en que el banco dijo «tienes esto».
 *
 * La cuenta de ahorros del portal se concilia contra la cuenta de la fuente en
 * el ledger. Con más de una cuenta de ahorros, se toma la primera; el detalle
 * deja constancia de cuál.
 */
export async function reconcileFromCaptures(
  deps: ReconciliationDeps,
  input: { owner: OwnerId; portalId: PortalId; captures: Capture[] },
): Promise<Reconciliation[]> {
  const { saldo } = summarizeSession(input.portalId, input.captures);
  if (saldo === null) return [];
  const ahorros = saldo.balance;

  const cuenta = sourceAccountId(input.portalId);
  if ((await deps.accounts.findById(cuenta)) === null) return [];

  const conciliacion = await reconcileAccount(deps, {
    owner: input.owner,
    accountId: cuenta,
    saldoReal: money(ahorros.saldo, ahorros.moneda),
    fecha: saldo.capturedAt,
    fuente: input.portalId,
    detalle: `${ahorros.nombre} ****${ahorros.numero.slice(-4)}`,
  });
  return [conciliacion];
}
