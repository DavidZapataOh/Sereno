import type { BudgetRepository } from '@/domain/budget/budget-repository';
import { estadoDe, type EnvelopeState } from '@/domain/budget/envelope';
import { repartoDe, type Reparto } from '@/domain/budget/allocation';
import { categoryAccountId } from '@/domain/categorization/taxonomy';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { OwnerId } from '@/domain/ledger/ids';
import { subtract, sum, zero, type Money } from '@/domain/money/money';

export interface BudgetDeps {
  accounts: AccountRepository;
  presupuesto: BudgetRepository;
  clock: () => string;
}

export interface HistoricoDeCategoria {
  categoria: string;
  /** El promedio mensual observado, o `null` si no hay historia suficiente. */
  promedio: Money | null;
  /** Sobre cuántos meses. Un promedio de un mes no es un promedio. */
  meses: number;
}

export interface MonthlyBudget {
  mes: string;
  sobres: EnvelopeState[];
  /** Gasto de categorías **sin sobre**: aparece igual, para que el total cuadre. */
  noPresupuestado: { categoria: string; gastado: Money }[];
  reparto: Reparto;
  historico: HistoricoDeCategoria[];
}

/** Con menos de esto, un promedio es ruido presentado como referencia. */
const MESES_MINIMOS = 2;
/** Cuántos meses atrás se mira para el promedio. */
const VENTANA = 3;

/**
 * El presupuesto de un mes: lo asignado, lo gastado y lo que queda.
 *
 * **Lo gastado sale del ledger**, no de nada guardado: una categoría es una
 * cuenta, así que el gasto del mes son dos cortes de `balanceOf` y una resta.
 *
 * El histórico va al lado de cada sobre para **informar la decisión mientras se
 * toma**, sin tomarla: Sereno no rellena nada, que es lo que David eligió.
 */
export async function monthlyBudget(
  deps: BudgetDeps,
  input: { owner: OwnerId; mes: string; categorias: readonly string[]; ingresoDelMes: Money },
): Promise<MonthlyBudget> {
  const sobres = await deps.presupuesto.listar(input.owner, input.mes);
  const conSobre = new Set(sobres.map((s) => s.categoria));
  const moneda = input.ingresoDelMes.currency;

  const estados: EnvelopeState[] = [];
  for (const sobre of sobres) {
    estados.push(estadoDe(sobre, await gastoDelMes(deps, sobre.categoria, input.mes, moneda)));
  }

  // Un gasto de una categoría sin sobre aparece igual: esconderlo haría que el
  // total del mes no cuadre con el ledger, y el presupuesto mentiría.
  const noPresupuestado: MonthlyBudget['noPresupuestado'] = [];
  for (const categoria of input.categorias) {
    if (conSobre.has(categoria)) continue;
    const gastado = await gastoDelMes(deps, categoria, input.mes, moneda);
    if (gastado.amount !== 0n) noPresupuestado.push({ categoria, gastado });
  }

  return {
    mes: input.mes,
    sobres: estados,
    noPresupuestado,
    reparto: repartoDe(input.ingresoDelMes, sobres),
    historico: await historicoDe(deps, input.categorias, input.mes, moneda),
  };
}

/**
 * Copiar el reparto del mes anterior.
 *
 * Es lo que hace el propio YNAB, y lo que mantiene corta la sesión mensual sin
 * romper «ningún peso sin asignar»: el punto de partida es lo del mes pasado y
 * David ajusta lo que cambió. **No pisa lo que ya se asignó este mes**: sería
 * deshacer una decisión que ya tomó.
 */
export async function copiarDelMesAnterior(
  deps: BudgetDeps,
  input: { owner: OwnerId; mes: string },
): Promise<number> {
  const anterior = await deps.presupuesto.listar(input.owner, mesAnterior(input.mes));
  const yaAsignadas = new Set(
    (await deps.presupuesto.listar(input.owner, input.mes)).map((s) => s.categoria),
  );

  let copiados = 0;
  for (const sobre of anterior) {
    if (yaAsignadas.has(sobre.categoria)) continue;
    await deps.presupuesto.guardar({ ...sobre, mes: input.mes });
    copiados += 1;
  }
  return copiados;
}

/** Lo gastado en una categoría durante un mes: dos cortes y una resta. */
async function gastoDelMes(
  deps: BudgetDeps,
  categoria: string,
  mes: string,
  moneda: Money['currency'],
): Promise<Money> {
  const id = categoryAccountId(categoria);
  if ((await deps.accounts.findById(id)) === null) return zero(moneda);

  const alCierre = await deps.accounts.balanceOf(id, { hasta: finDe(mes) });
  const alInicio = await deps.accounts.balanceOf(id, { hasta: finDe(mesAnterior(mes)) });
  return subtract(alCierre, alInicio);
}

async function historicoDe(
  deps: BudgetDeps,
  categorias: readonly string[],
  mes: string,
  moneda: Money['currency'],
): Promise<HistoricoDeCategoria[]> {
  const salida: HistoricoDeCategoria[] = [];

  for (const categoria of categorias) {
    const gastos: Money[] = [];
    let cursor = mesAnterior(mes);
    for (let i = 0; i < VENTANA; i += 1) {
      gastos.push(await gastoDelMes(deps, categoria, cursor, moneda));
      cursor = mesAnterior(cursor);
    }

    // Solo cuentan los meses con movimiento: un mes sin datos no es un mes de
    // «gasté cero», es un mes en el que la app no existía.
    const conDatos = gastos.filter((g) => g.amount !== 0n);
    salida.push({
      categoria,
      meses: conDatos.length,
      promedio:
        conDatos.length < MESES_MINIMOS
          ? null
          : {
              amount: sum(conDatos, moneda).amount / BigInt(conDatos.length),
              currency: moneda,
            },
    });
  }
  return salida;
}

function mesAnterior(mes: string): string {
  const [anio = 1970, m = 1] = mes.split('-').map(Number);
  const total = (anio - 1) * 12 + (m - 1) - 1;
  return `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** El último instante de un mes, para cortar el saldo. */
function finDe(mes: string): string {
  const [anio = 1970, m = 1] = mes.split('-').map(Number);
  const total = (anio - 1) * 12 + m;
  const siguiente = `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
  return `${siguiente}-01T00:00:00.000-05:00`;
}
