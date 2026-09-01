import type { OwnerId } from '@/domain/ledger/ids';
import { subtract, type Money } from '@/domain/money/money';

/**
 * Un sobre: lo que se decidió asignar a una categoría para un mes.
 *
 * **Lo gastado no está aquí.** Una categoría ya es una cuenta (ADR 0005), así
 * que «cuánto llevo en Mercado este mes» es `balanceOf` entre dos cortes. Lo
 * único que se guarda es la asignación, que es una decisión y no se puede
 * derivar de nada.
 */
export interface Envelope {
  owner: OwnerId;
  /** `AAAA-MM`. */
  mes: string;
  /** El slug de la categoría, sin el prefijo `categoria:`. */
  categoria: string;
  asignado: Money;
}

export interface EnvelopeState {
  envelope: Envelope;
  gastado: Money;
  queda: Money;
  sobregirado: boolean;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function createEnvelope(input: Envelope): Envelope {
  if (!MES.test(input.mes)) throw new Error(`Un mes se escribe AAAA-MM, no "${input.mes}"`);
  if (input.categoria.trim().length === 0) throw new Error('El sobre necesita una categoría');
  if (input.asignado.amount < 0n) throw new Error('No se puede asignar una cantidad negativa');
  return { ...input };
}

/**
 * Cuánto queda en un sobre.
 *
 * **Gastar de más deja el sobre en negativo, no en cero.** Recortarlo escondería
 * el problema justo donde hay que verlo, y dejaría el total del presupuesto
 * mintiendo: la suma de los sobres ya no cuadraría con lo que salió de verdad.
 */
export function estadoDe(envelope: Envelope, gastado: Money): EnvelopeState {
  const queda = subtract(envelope.asignado, gastado);
  return { envelope, gastado, queda, sobregirado: queda.amount < 0n };
}
