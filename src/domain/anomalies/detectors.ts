import type { TransactionId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';

import { anomalyId, createAnomaly, type Anomaly } from './anomaly';

export interface CobroConFecha {
  transaccion: TransactionId;
  comercio: string;
  /** El nombre legible, para la explicación. */
  nombre: string;
  monto: Money;
  /** `AAAA-MM-DD`. */
  dia: string;
}

/**
 * Dos cobros **reales** del mismo comercio el mismo día.
 *
 * No es un duplicado de ingesta: eso lo resuelve `domain/ingest/duplicates.ts`
 * desde el sprint 04, y lo que llega aquí ya pasó por ahí. Esto son dos cargos
 * que de verdad ocurrieron, que a veces es un error del comercio.
 */
export function cobroRepetido(cobros: readonly CobroConFecha[]): Anomaly[] {
  const porDiaYComercio = new Map<string, CobroConFecha[]>();
  for (const c of cobros) {
    const clave = `${c.dia}:${c.comercio}`;
    porDiaYComercio.set(clave, [...(porDiaYComercio.get(clave) ?? []), c]);
  }

  const salida: Anomaly[] = [];
  for (const grupo of porDiaYComercio.values()) {
    if (grupo.length < 2) continue;
    const segundo = grupo[1];
    if (segundo === undefined) continue;

    salida.push(
      createAnomaly({
        id: anomalyId('cobro-repetido', segundo.transaccion),
        tipo: 'cobro-repetido',
        transaccion: segundo.transaccion,
        explicacion: `${segundo.nombre} te cobró ${String(grupo.length)} veces el mismo día`,
        comparadoCon: 'los demás cobros de ese comercio ese día',
        confianza: 0.7,
      }),
    );
  }
  return salida;
}

/** Cuántos meses sin aparecer para considerarlo dormido. */
const MESES_DORMIDO = 6;

/**
 * Un comercio que llevaba medio año sin aparecer y de pronto cobra.
 *
 * Una tarjeta clonada suele empezar así. La confianza es baja a propósito: la
 * mayoría de las veces es que uno volvió a un restaurante.
 */
export function comercioDormido(
  cobro: CobroConFecha,
  ultimaVez: string | null,
  hoy: string,
): Anomaly | null {
  // Sin historia previa no es «dormido»: es la primera vez, y eso es normal.
  if (ultimaVez === null) return null;

  const meses = mesesEntre(ultimaVez, hoy);
  if (meses < MESES_DORMIDO) return null;

  return createAnomaly({
    id: anomalyId('comercio-dormido', cobro.transaccion),
    tipo: 'comercio-dormido',
    transaccion: cobro.transaccion,
    explicacion: `${cobro.nombre} no aparecía desde hace ${String(meses)} meses`,
    comparadoCon: `su último cobro, en ${ultimaVez.slice(0, 7)}`,
    confianza: 0.4,
  });
}

function mesesEntre(desde: string, hasta: string): number {
  const [a1 = 0, m1 = 1] = desde.slice(0, 7).split('-').map(Number);
  const [a2 = 0, m2 = 1] = hasta.slice(0, 7).split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}
