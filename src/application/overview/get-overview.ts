import type { IngestRepository } from '@/domain/ingest/ingest-repository';
import type { IngestRun } from '@/domain/ingest/ingest-run';
import { isRealAccount, type Account } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { OwnerId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { absolute, add, zero, type Money } from '@/domain/money/money';
import { PORTALS } from '@/domain/portals/registry';
import type { Reconciliation } from '@/domain/reconciliation/reconciliation';
import type { ReconciliationRepository } from '@/domain/reconciliation/reconciliation-repository';

export interface OverviewDeps {
  accounts: AccountRepository;
  ingest: IngestRepository;
  reconciliations: ReconciliationRepository;
}

export interface AccountSummary {
  account: Account;
  saldo: Money;
}

export interface Overview {
  /** Activos menos pasivos, en pesos. Lo que no se pudo valorar va aparte. */
  patrimonio: Money;
  cuentas: AccountSummary[];
  /**
   * Saldos que existen y **no** están sumados en el patrimonio, porque están
   * en otra moneda y todavía no hay con qué valorarlos.
   *
   * Van aparte y no como cero: un total que calla lo que no supo valorar
   * miente por omisión, y se ve perfectamente bien.
   */
  sinValorar: AccountSummary[];
  sinClasificar: { gastos: Money; ingresos: Money };
  ultimaSincronizacion: IngestRun | null;
  conciliacion: Reconciliation | null;
}

/** Cuentas contables del sistema: existen para cuadrar, no para mostrarse. */
const NO_SE_MUESTRAN = new Set<string>([
  systemAccountId('gastos-sin-clasificar'),
  systemAccountId('ingresos-sin-clasificar'),
  systemAccountId('ajustes'),
]);

export async function getOverview(deps: OverviewDeps, owner: OwnerId): Promise<Overview> {
  const todas = await deps.accounts.listByOwner(owner);
  const reales = todas.filter((c) => isRealAccount(c.kind) && !NO_SE_MUESTRAN.has(c.id));

  const cuentas: AccountSummary[] = [];
  const sinValorar: AccountSummary[] = [];
  let patrimonio = zero('COP');
  for (const account of reales) {
    const saldo = await deps.accounts.balanceOf(account.id);
    cuentas.push({ account, saldo });
    if (account.currency === 'COP') {
      // El saldo de un pasivo ya es negativo en el ledger: sumar es restar.
      patrimonio = add(patrimonio, saldo);
    } else {
      // Hasta que el plan 03 traiga las tasas, lo que no está en pesos se
      // lista pero no se suma, y se declara.
      sinValorar.push({ account, saldo });
    }
  }

  const saldoDe = async (
    key: 'gastos-sin-clasificar' | 'ingresos-sin-clasificar',
  ): Promise<Money> =>
    todas.some((c) => c.id === systemAccountId(key))
      ? absolute(await deps.accounts.balanceOf(systemAccountId(key)))
      : zero('COP');

  const corridas = await Promise.all(PORTALS.map((p) => deps.ingest.findLastRun(owner, p.id)));
  const ultimaSincronizacion =
    corridas
      .filter((r): r is IngestRun => r !== null)
      .sort((a, b) => b.iniciadoEn.localeCompare(a.iniciadoEn))[0] ?? null;

  const conciliaciones = await Promise.all(
    reales.map((c) => deps.reconciliations.findLatest(c.id)),
  );
  const conciliacion =
    conciliaciones
      .filter((r): r is Reconciliation => r !== null)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;

  return {
    patrimonio,
    cuentas,
    sinValorar,
    sinClasificar: {
      gastos: await saldoDe('gastos-sin-clasificar'),
      ingresos: await saldoDe('ingresos-sin-clasificar'),
    },
    ultimaSincronizacion,
    conciliacion,
  };
}
