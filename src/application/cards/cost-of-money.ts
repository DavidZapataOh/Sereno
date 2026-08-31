import { emparejarGmf, type MovimientoParaAtar } from '@/domain/ingest/gmf-link';
import type { OwnerId, TransactionId } from '@/domain/ledger/ids';
import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { add, zero, type Money } from '@/domain/money/money';

import { listMovements, type MovementsDeps } from '../movements/movements';

/**
 * Las categorías del grupo «finanzas» que son coste de mover o tener el
 * dinero, no decisiones de consumo.
 *
 * Existen desde el sprint 05: aquí no se crea ninguna, se usan. Los impuestos
 * generales quedan fuera a propósito —pagar la declaración de renta no es un
 * coste de mover dinero—.
 */
export const CATEGORIAS_DE_COSTO = [
  'cuatro-por-mil',
  'comisiones-bancarias',
  'intereses-de-credito',
  'seguros',
] as const;

export type CategoriaDeCosto = (typeof CATEGORIAS_DE_COSTO)[number];

export interface CostOfMoney {
  total: Money;
  /** Cuánto de cada tipo. Las que no aparecieron van en cero. */
  porTipo: Record<CategoriaDeCosto, Money>;
  /** Lo que se movió en el periodo, para poner el total en contexto. */
  movido: Money;
  /** Qué proporción de lo movido se fue en costes. 0 si no se movió nada. */
  proporcion: number;
  /** El movimiento que más caro salió, si se pudo atar su 4×1000. */
  masCaro: { transaccion: TransactionId; costo: Money } | null;
}

export interface CostOfMoneyDeps extends MovementsDeps {
  clock: () => string;
}

const VENTANA = 2000;

/**
 * Cuánto cuesta tener y mover el dinero en un periodo.
 *
 * El total dice poco por sí solo —«$48.000 al año» no significa nada—; la
 * proporción de lo movido sí dice qué hacer. Y el movimiento más caro es lo
 * único de todo esto que puede cambiar una conducta.
 */
export async function costOfMoney(
  deps: CostOfMoneyDeps,
  input: { owner: OwnerId; desde: string; hasta: string },
): Promise<CostOfMoney> {
  const pagina = await listMovements(deps, { owner: input.owner, limit: VENTANA });
  const enRango = pagina.items.filter((m) => m.fecha >= input.desde && m.fecha <= input.hasta);

  const moneda = enRango[0]?.monto.currency ?? 'COP';
  const porTipo = Object.fromEntries(CATEGORIAS_DE_COSTO.map((c) => [c, zero(moneda)])) as Record<
    CategoriaDeCosto,
    Money
  >;

  let total = zero(moneda);
  let movido = zero(moneda);
  const cargosGmf: MovimientoParaAtar[] = [];
  const salidas: MovimientoParaAtar[] = [];

  for (const m of enRango) {
    const tipo = CATEGORIAS_DE_COSTO.find(
      (c) => m.categoria !== null && m.categoria.id === categoryAccountId(c),
    );

    if (tipo === undefined) {
      // Lo que sale y no es un coste es dinero movido: es el denominador.
      if (m.direction === 'sale') {
        movido = add(movido, m.monto);
        salidas.push({ id: m.id, fecha: m.fecha, monto: m.monto });
      }
      continue;
    }

    porTipo[tipo] = add(porTipo[tipo], m.monto);
    total = add(total, m.monto);
    if (tipo === 'cuatro-por-mil') {
      cargosGmf.push({ id: m.id, fecha: m.fecha, monto: m.monto });
    }
  }

  const atados = emparejarGmf(cargosGmf, salidas);
  const masCaro = [...atados.entries()]
    .map(([cargo, origen]) => ({
      transaccion: origen,
      costo: cargosGmf.find((c) => c.id === cargo)?.monto ?? zero(moneda),
    }))
    .sort((a, b) => Number(b.costo.amount - a.costo.amount))[0];

  return {
    total,
    porTipo,
    movido,
    // Sin nada movido, cero: no se divide por cero para llenar una pantalla.
    proporcion: movido.amount === 0n ? 0 : Number(total.amount) / Number(movido.amount),
    masCaro: masCaro ?? null,
  };
}
