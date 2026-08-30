import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, IdGenerator, OwnerId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';
import { reconcile, type Reconciliation } from '@/domain/reconciliation/reconciliation';
import type { ReconciliationRepository } from '@/domain/reconciliation/reconciliation-repository';

export interface ReconciliationDeps {
  accounts: AccountRepository;
  reconciliations: ReconciliationRepository;
  ids: IdGenerator;
  clock: () => string;
}

export async function reconcileAccount(
  deps: ReconciliationDeps,
  input: {
    owner: OwnerId;
    accountId: AccountId;
    saldoReal: Money;
    fecha: string;
    fuente: string;
    detalle: string;
  },
): Promise<Reconciliation> {
  const cuenta = await deps.accounts.findById(input.accountId);
  if (cuenta === null || cuenta.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.accountId}"`);
  }

  const saldoCalculado = await deps.accounts.balanceOf(input.accountId, { hasta: input.fecha });
  const { diferencia, veredicto } = reconcile({ saldoReal: input.saldoReal, saldoCalculado });

  const conciliacion: Reconciliation = {
    id: deps.ids.next(),
    owner: input.owner,
    accountId: input.accountId,
    fecha: input.fecha,
    saldoReal: input.saldoReal,
    saldoCalculado,
    diferencia,
    veredicto,
    fuente: input.fuente,
    detalle: input.detalle,
    creadoEn: deps.clock(),
  };
  await deps.reconciliations.save(conciliacion);
  return conciliacion;
}
