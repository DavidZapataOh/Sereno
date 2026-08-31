import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { daysBetween } from '@/domain/time/colombia';

import { type Channel, via } from './channel';
import { dayOf, fingerprintOf, normalizeDescription } from './fingerprint';
import type { Observation } from './observation';

const DIA_MS = 24 * 60 * 60 * 1000;

function sumarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00.000Z`) + n * DIA_MS).toISOString().slice(0, 10);
}

/** Un instante comparable para una normalizada, venga en el formato que venga. */
function instanteDe(n: NormalizedTransaction): string {
  return /^\d{4}\/\d{2}\/\d{2}$/.test(n.fecha)
    ? `${n.fecha.replace(/\//g, '-')}T12:00:00.000-05:00`
    : n.fecha;
}

/**
 * Huellas con las que buscar un duplicado.
 *
 * La tolerancia existe porque las fuentes no asientan el mismo día: el correo
 * llega en el momento de la compra y la web la registra al día siguiente.
 * Se generan huellas concretas en vez de un rango para que la búsqueda vaya
 * por índice, con igualdad exacta.
 */
export function candidateFingerprints(n: NormalizedTransaction, toleranciaDias = 1): string[] {
  const dia = dayOf(n);
  const resto = `${String(n.monto)}|${normalizeDescription(n.descripcion)}`;
  const huellas: string[] = [];
  for (let d = -toleranciaDias; d <= toleranciaDias; d += 1) {
    huellas.push(`${sumarDias(dia, d)}|${resto}`);
  }
  return huellas;
}

/**
 * Referencia derivada para las fuentes que no traen una.
 *
 * Sin referencia no hay id determinista y cada reproceso duplicaría. Se deriva
 * de la huella más un ordinal dentro del lote: así dos compras idénticas el
 * mismo día siguen siendo dos, y el mismo lote produce siempre las mismas.
 */
export function assignDerivedReferences(lote: NormalizedTransaction[]): NormalizedTransaction[] {
  const vistos = new Map<string, number>();
  return lote.map((n) => {
    if (n.referencia !== null && n.referencia.trim().length > 0) return n;
    const huella = fingerprintOf(n);
    const ordinal = (vistos.get(huella) ?? 0) + 1;
    vistos.set(huella, ordinal);
    return { ...n, referencia: `h:${huella}#${String(ordinal)}` };
  });
}

export interface MatchContext {
  observation: Observation;
  /**
   * Vías —fuente y canal— que ya aportaron una observación a esa transacción.
   *
   * Antes eran solo fuentes. No bastaba: Bancolombia llega por el portal y
   * por el correo, con referencias distintas, y «la misma fuente ya la vio»
   * impedía fundirlas. El mismo gasto entraba dos veces.
   */
  viasQueLaVieron: string[];
}

/**
 * Elige, entre las observaciones con huella compatible, la que representa la
 * misma transacción que el candidato.
 *
 * Reglas, en orden:
 *  1. Nunca la misma vía: dentro de una fuente **y un canal** la identidad es
 *     la referencia.
 *  2. Nunca una transacción que esta vía ya vio: uno a uno por vía.
 *  3. Entre las que quedan, la del día más cercano; a igual distancia, la
 *     observada primero.
 */
export function chooseDuplicate(
  candidate: NormalizedTransaction,
  canal: Channel,
  contextos: MatchContext[],
): Observation | null {
  const fechaCandidato = instanteDe(candidate);
  const viaCandidato = via(candidate.fuente, canal);

  const elegibles = contextos.filter(
    (c) =>
      via(c.observation.fuente, c.observation.canal) !== viaCandidato &&
      !c.viasQueLaVieron.includes(viaCandidato),
  );
  if (elegibles.length === 0) return null;

  const distancia = (o: Observation): number => daysBetween(fechaCandidato, instanteDe(o.crudo));

  elegibles.sort((a, b) => {
    const porDia = distancia(a.observation) - distancia(b.observation);
    if (porDia !== 0) return porDia;
    return a.observation.capturadoEn.localeCompare(b.observation.capturadoEn);
  });

  return elegibles[0]?.observation ?? null;
}
