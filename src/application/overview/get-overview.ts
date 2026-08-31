import type { IngestRepository } from '@/domain/ingest/ingest-repository';
import type { IngestRun } from '@/domain/ingest/ingest-run';
import { isRealAccount, type Account } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { OwnerId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { absolute, add, zero, type Money } from '@/domain/money/money';
import { PORTALS } from '@/domain/portals/registry';
import type { Reconciliation } from '@/domain/reconciliation/reconciliation';
import type { RateRepository } from '@/domain/rates/rate-repository';
import type { Rate } from '@/domain/rates/rate';
import type { ReconciliationRepository } from '@/domain/reconciliation/reconciliation-repository';

import { valorarEnCOP } from './value-in-cop';

export interface OverviewDeps {
  accounts: AccountRepository;
  ingest: IngestRepository;
  reconciliations: ReconciliationRepository;
  rates: RateRepository;
}

export interface AccountSummary {
  account: Account;
  saldo: Money;
  /** El saldo en pesos, o `null` si no se pudo valorar. */
  enPesos: Money | null;
}

export interface Overview {
  /** Activos menos pasivos, en pesos. Lo que no se pudo valorar va aparte. */
  patrimonio: Money;
  cuentas: AccountSummary[];
  /**
   * Saldos que existen y **no** están sumados en el patrimonio, porque no hay
   * con qué valorarlos.
   *
   * Van aparte y no como cero: un total que calla lo que no supo valorar
   * miente por omisión, y se ve perfectamente bien.
   */
  sinValorar: AccountSummary[];
  /** Con qué tasas se valoró, para poder decir de cuándo son. */
  tasasUsadas: Rate[];
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

  const tasas = await deps.rates.vigentes();
  const cuentas: AccountSummary[] = [];
  const sinValorar: AccountSummary[] = [];
  const tasasUsadas = new Map<string, Rate>();
  let patrimonio = zero('COP');

  for (const account of reales) {
    const saldo = await deps.accounts.balanceOf(account.id);
    const valoracion = valorarEnCOP(saldo, tasas);

    if (valoracion.estado === 'sin-valorar') {
      // No se suma como cero: eso haría que el total mintiera por omisión.
      const resumen = { account, saldo, enPesos: null };
      cuentas.push(resumen);
      sinValorar.push(resumen);
      continue;
    }

    cuentas.push({ account, saldo, enPesos: valoracion.enPesos });
    // El saldo de un pasivo ya es negativo en el ledger: sumar es restar.
    patrimonio = add(patrimonio, valoracion.enPesos);
    if (valoracion.tasa !== null) {
      tasasUsadas.set(`${valoracion.tasa.desde}->${valoracion.tasa.hacia}`, valoracion.tasa);
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
    tasasUsadas: [...tasasUsadas.values()],
    sinClasificar: {
      gastos: await saldoDe('gastos-sin-clasificar'),
      ingresos: await saldoDe('ingresos-sin-clasificar'),
    },
    ultimaSincronizacion,
    conciliacion,
  };
}
