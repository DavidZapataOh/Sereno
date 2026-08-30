import { balanceExtractorFor } from '@/domain/capture/extractors';
import type { Capture } from '@/domain/capture/reassembler';
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
  const extraer = balanceExtractorFor(input.portalId);
  if (extraer === null) return [];

  const conSaldos = input.captures
    .map((c) => ({ captura: c, saldos: extraer(c) }))
    .filter((x) => x.saldos.length > 0)
    .sort((a, b) => b.captura.capturedAt.localeCompare(a.captura.capturedAt));
  const reciente = conSaldos[0];
  if (reciente === undefined) return [];

  const ahorros = reciente.saldos.find((s) => /ahorro/i.test(s.nombre)) ?? reciente.saldos[0];
  if (ahorros === undefined) return [];

  const cuenta = sourceAccountId(input.portalId);
  if ((await deps.accounts.findById(cuenta)) === null) return [];

  const conciliacion = await reconcileAccount(deps, {
    owner: input.owner,
    accountId: cuenta,
    saldoReal: money(ahorros.saldo, ahorros.moneda),
    fecha: reciente.captura.capturedAt,
    fuente: input.portalId,
    detalle: `${ahorros.nombre} ****${ahorros.numero.slice(-4)}`,
  });
  return [conciliacion];
}
