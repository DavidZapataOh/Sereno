import { categoryAccountId, DEFAULT_CATEGORIES } from '@/domain/categorization/taxonomy';
import { isRealAccount } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { OwnerId } from '@/domain/ledger/ids';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';
import {
  antiguedadDelDinero,
  deudaSobreIngreso,
  mesesDeColchon,
  tasaDeAhorro,
  type Metrica,
  type MovimientoDeCaja,
} from '@/domain/metrics/behavior';
import { add, zero, type Money } from '@/domain/money/money';
import { calendarDay } from '@/domain/time/colombia';

export interface BehaviorDeps {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  clock: () => string;
}

export interface ResumenMetricas {
  metricas: Metrica[];
  /** Las que no se pudieron calcular, con su clave. No salen como cero. */
  sinDatos: string[];
}

/** Cuántos meses atrás se mira. */
const VENTANA = 3;
/** Cuántos movimientos se leen. Tres meses no traen más. */
const LIMITE = 2000;

/**
 * Las cuatro métricas de conducta, del ledger.
 *
 * **Ninguna tabla nueva.** El flujo de caja sale de los apuntes sobre cuentas de
 * activo; el gasto y el ingreso, de las cuentas de categoría; la deuda, de los
 * pasivos. Todo derivado.
 *
 * Lo que no se puede calcular **se declara en `sinDatos`**, no se devuelve como
 * cero: cero es una afirmación, y «no lo sé» es otra.
 */
export async function behaviorMetrics(
  deps: BehaviorDeps,
  input: { owner: OwnerId },
): Promise<ResumenMetricas> {
  const hoy = calendarDay(deps.clock());
  const desde = mesesAntes(hoy, VENTANA);
  const cuentas = await deps.accounts.listByOwner(input.owner);
  const activos = cuentas.filter((c) => c.kind === 'activo');
  const moneda = 'COP' as const;

  // --- Flujo de caja sobre las cuentas de activo, para la antigüedad.
  const entradas: MovimientoDeCaja[] = [];
  const salidas: MovimientoDeCaja[] = [];
  const pagina = await deps.transactions.list(input.owner, {}, { limit: LIMITE });
  const esActivo = new Set(activos.map((c) => c.id));

  for (const t of pagina.items) {
    const dia = calendarDay(t.fecha);
    if (dia < desde) continue;
    for (const apunte of t.postings) {
      if (!esActivo.has(apunte.accountId)) continue;
      if (apunte.amount.amount > 0n) entradas.push({ dia, monto: apunte.amount });
      if (apunte.amount.amount < 0n) {
        salidas.push({ dia, monto: { amount: -apunte.amount.amount, currency: moneda } });
      }
    }
  }

  // --- Ingreso y gasto del periodo, de las cuentas de categoría.
  const gasto = await totalDeCategorias(deps, input.owner, 'gasto', desde, hoy, moneda);
  const ingreso = await totalDeCategorias(deps, input.owner, 'ingreso', desde, hoy, moneda);

  const saldo = await sumaDe(
    deps,
    activos.map((c) => c.id),
    moneda,
  );
  const deuda = await sumaDe(
    deps,
    cuentas.filter((c) => c.kind === 'pasivo' && isRealAccount(c.kind)).map((c) => c.id),
    moneda,
  );

  const porMes = (m: Money): Money => ({ amount: m.amount / BigInt(VENTANA), currency: moneda });
  const candidatas: [string, Metrica | null][] = [
    ['antiguedad-del-dinero', antiguedadDelDinero(entradas, salidas, VENTANA)],
    ['tasa-de-ahorro', tasaDeAhorro(porMes(ingreso), porMes(gasto), VENTANA)],
    ['meses-de-colchon', mesesDeColchon(saldo, porMes(gasto), VENTANA)],
    ['deuda-sobre-ingreso', deudaSobreIngreso(deuda, porMes(ingreso), VENTANA)],
  ];

  return {
    metricas: candidatas.map(([, m]) => m).filter((m): m is Metrica => m !== null),
    sinDatos: candidatas.filter(([, m]) => m === null).map(([clave]) => clave),
  };
}

/** El total movido por las categorías de un tipo entre dos días. */
async function totalDeCategorias(
  deps: BehaviorDeps,
  owner: OwnerId,
  kind: 'gasto' | 'ingreso',
  desde: string,
  hasta: string,
  moneda: Money['currency'],
): Promise<Money> {
  let total = zero(moneda);
  for (const spec of DEFAULT_CATEGORIES.filter((c) => c.kind === kind)) {
    const id = categoryAccountId(spec.slug);
    // El propietario se comprueba: una cuenta de categoría se encuentra por su
    // id sin importar de quién sea, y sin esto las cifras de uno se colarían
    // en las métricas de otro.
    const cuenta = await deps.accounts.findById(id);
    if (cuenta === null || cuenta.owner !== owner) continue;

    const cierre = await deps.accounts.balanceOf(id, { hasta: `${hasta}T23:59:59.999-05:00` });
    const inicio = await deps.accounts.balanceOf(id, { hasta: `${desde}T00:00:00.000-05:00` });
    // El gasto sube la cuenta de gasto; el ingreso la baja. Se toma el tamaño.
    const delta = cierre.amount - inicio.amount;
    total = add(total, { amount: delta < 0n ? -delta : delta, currency: moneda });
  }
  return total;
}

async function sumaDe(
  deps: BehaviorDeps,
  ids: readonly string[],
  moneda: Money['currency'],
): Promise<Money> {
  let total = zero(moneda);
  for (const id of ids) {
    const saldo = await deps.accounts.balanceOf(id as never);
    if (saldo.currency === moneda) total = add(total, saldo);
  }
  return total;
}

function mesesAntes(dia: string, n: number): string {
  const [anio = 1970, m = 1, d = 1] = dia.split('-').map(Number);
  const total = (anio - 1) * 12 + (m - 1) - n;
  return `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
