import type { OwnerId } from '@/domain/ledger/ids';
import { add, zero, type Money } from '@/domain/money/money';
import { detectSubscriptions } from '@/domain/subscriptions/detect';
import { priceChangeOf, type PriceChange } from '@/domain/subscriptions/price-change';
import type { CobroCandidato, Subscription } from '@/domain/subscriptions/subscription';

import { listMovements, type MovementsDeps } from '../movements/movements';

export interface SubscriptionView extends Subscription {
  cambio: PriceChange | null;
}

export interface SubscriptionsSummary {
  suscripciones: SubscriptionView[];
  /** Lo que se va cada mes en suscripciones vivas. El número que sorprende. */
  totalMensual: Money;
}

export interface SubscriptionsDeps extends MovementsDeps {
  clock: () => string;
}

/**
 * Cuántos movimientos se miran hacia atrás.
 *
 * Una anual necesita tres cobros, o sea tres años. Con 2000 movimientos se
 * cubre de sobra un historial largo sin traerse la base entera a memoria; si
 * algún día no basta, el sprint 12 lo verá en las métricas y no aquí.
 */
const VENTANA = 2000;

/** Cuántos cobros mensuales equivale cada cadencia, para el total del mes. */
const AL_MES: Record<Subscription['cadencia'], number> = {
  quincenal: 2,
  mensual: 1,
  bimestral: 0.5,
  trimestral: 1 / 3,
  anual: 1 / 12,
};

/**
 * Las suscripciones que se deducen del ledger.
 *
 * No guarda nada: se recalcula al mirar. Una suscripción es una lectura sobre
 * lo que ya pasó, y si la detección mejora, mejora todo el historial —igual
 * que el comercio del sprint 05—.
 */
export async function listSubscriptions(
  deps: SubscriptionsDeps,
  input: { owner: OwnerId },
): Promise<SubscriptionsSummary> {
  const pagina = await listMovements(deps, { owner: input.owner, limit: VENTANA });

  const candidatos: CobroCandidato[] = pagina.items.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    monto: m.monto,
    claveComercio: m.comercio.clave,
    nombreComercio: m.comercio.nombre,
    esTransferencia: m.esTransferencia,
    sale: m.direction === 'sale',
  }));

  const detectadas = detectSubscriptions(candidatos, deps.clock());
  const suscripciones = detectadas.map((s) => ({ ...s, cambio: priceChangeOf(s) }));

  // Solo las vivas: sumar una cancelada diría que se va una plata que ya no
  // se va.
  const vivas = suscripciones.filter((s) => s.proximoCobro !== null);
  const totalMensual = vivas.reduce<Money>(
    (suma, s) =>
      add(suma, {
        amount: escalar(s.monto.amount, AL_MES[s.cadencia]),
        currency: s.monto.currency,
      }),
    zero(vivas[0]?.monto.currency ?? 'COP'),
  );

  return { suscripciones, totalMensual };
}

/**
 * Multiplica un entero por un factor fraccionario sin pasar por `float`.
 *
 * Se escala por mil y se divide: un tercio de $30.000 da $9.990, no
 * $9.999,9999. La precisión sobra para un total orientativo y no introduce
 * decimales que después habría que redondear en la pantalla.
 */
function escalar(monto: bigint, factor: number): bigint {
  return (monto * BigInt(Math.round(factor * 1000))) / 1000n;
}
