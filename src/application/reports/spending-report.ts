import { categoryAccountId, DEFAULT_CATEGORIES } from '@/domain/categorization/taxonomy';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { OwnerId } from '@/domain/ledger/ids';
import { zero, type Money } from '@/domain/money/money';
import { finDeMes, mesAnterior } from '@/domain/time/month';

export interface ReportDeps {
  accounts: AccountRepository;
  clock: () => string;
}

export interface GastoDeCategoria {
  categoria: string;
  total: Money;
  /** Con una cifra decimal. Los porcentajes suman 100 exacto. */
  porcentaje: number;
}

export interface GastoDeMes {
  /** `AAAA-MM`. */
  mes: string;
  total: Money;
}

export interface FlujoDeMes {
  mes: string;
  entra: Money;
  sale: Money;
}

/**
 * En qué se fue la plata de un mes, de mayor a menor.
 *
 * Ordenado así porque **la pregunta es «en qué se me va»**: lo primero que se
 * lee tiene que ser lo que más pesa.
 *
 * Los porcentajes se reparten con el resto asignado al mayor, para que **sumen
 * 100 exacto**: tres categorías al 33,3 % dan 99,9 y quien lo lea va a
 * preguntarse dónde está el que falta.
 */
export async function porCategoria(
  deps: ReportDeps,
  input: { owner: OwnerId; mes: string },
): Promise<GastoDeCategoria[]> {
  const moneda = 'COP' as const;
  const filas: GastoDeCategoria[] = [];
  let total = 0n;

  for (const spec of DEFAULT_CATEGORIES.filter((c) => c.kind === 'gasto')) {
    const gasto = await gastoDelMes(deps, input.owner, spec.slug, input.mes, moneda);
    if (gasto.amount === 0n) continue;
    filas.push({ categoria: spec.slug, total: gasto, porcentaje: 0 });
    total += gasto.amount;
  }

  if (total === 0n) return [];

  filas.sort((a, b) => (a.total.amount < b.total.amount ? 1 : -1));

  let repartido = 0;
  for (const [i, fila] of filas.entries()) {
    if (i === 0) continue;
    fila.porcentaje = Math.round((Number(fila.total.amount) / Number(total)) * 1000) / 10;
    repartido += fila.porcentaje;
  }
  // El resto va al mayor: así la suma da 100 exacto sin inventar decimales.
  const mayor = filas[0];
  if (mayor !== undefined) mayor.porcentaje = Math.round((100 - repartido) * 10) / 10;

  return filas;
}

/** La evolución de **una** categoría. Mezclarlas en una vista no responde nada. */
export async function porMes(
  deps: ReportDeps,
  input: { owner: OwnerId; categoria: string; meses: number; hasta: string },
): Promise<GastoDeMes[]> {
  const moneda = 'COP' as const;
  const salida: GastoDeMes[] = [];

  for (const mes of mesesHasta(input.hasta, input.meses)) {
    salida.push({ mes, total: await gastoDelMes(deps, input.owner, input.categoria, mes, moneda) });
  }
  return salida;
}

/** Lo que entra y lo que sale cada mes, en la misma fila: la resta se ve sola. */
export async function entradasYSalidas(
  deps: ReportDeps,
  input: { owner: OwnerId; meses: number; hasta: string },
): Promise<FlujoDeMes[]> {
  const moneda = 'COP' as const;
  const gastos = DEFAULT_CATEGORIES.filter((c) => c.kind === 'gasto');
  const ingresos = DEFAULT_CATEGORIES.filter((c) => c.kind === 'ingreso');
  const salida: FlujoDeMes[] = [];

  for (const mes of mesesHasta(input.hasta, input.meses)) {
    let sale = 0n;
    let entra = 0n;
    for (const spec of gastos) {
      sale += (await gastoDelMes(deps, input.owner, spec.slug, mes, moneda)).amount;
    }
    for (const spec of ingresos) {
      entra += (await gastoDelMes(deps, input.owner, spec.slug, mes, moneda)).amount;
    }
    salida.push({
      mes,
      entra: { amount: entra, currency: moneda },
      sale: { amount: sale, currency: moneda },
    });
  }
  return salida;
}

/**
 * Lo movido por una categoría en un mes: dos cortes de `balanceOf` y una resta.
 *
 * Se agrega **antes** de dibujar. Con dos años de historial, devolver los
 * movimientos uno a uno serían miles de filas que ni se leen ni se pintan.
 */
async function gastoDelMes(
  deps: ReportDeps,
  owner: OwnerId,
  slug: string,
  mes: string,
  moneda: Money['currency'],
): Promise<Money> {
  const id = categoryAccountId(slug);
  const cuenta = await deps.accounts.findById(id);
  // El propietario se comprueba: una cuenta de categoría se encuentra por su id
  // sin importar de quién sea.
  if (cuenta === null || cuenta.owner !== owner) return zero(moneda);

  const cierre = await deps.accounts.balanceOf(id, { hasta: finDeMes(mes) });
  const inicio = await deps.accounts.balanceOf(id, { hasta: finDeMes(mesAnterior(mes)) });
  const delta = cierre.amount - inicio.amount;
  return { amount: delta < 0n ? -delta : delta, currency: moneda };
}

function mesesHasta(hasta: string, cuantos: number): string[] {
  const [anio = 1970, m = 1] = hasta.slice(0, 7).split('-').map(Number);
  return Array.from({ length: cuantos }, (_, i) => {
    const total = (anio - 1) * 12 + (m - 1) - (cuantos - 1 - i);
    return `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}
