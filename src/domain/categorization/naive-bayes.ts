import type { AccountId } from '@/domain/ledger/ids';

import { tokensOf } from './merchant';

/**
 * Cuántas veces se vio un rasgo en una categoría. El modelo entero son
 * estas filas: aprender es sumar, predecir es multiplicar probabilidades.
 */
export interface Evidence {
  feature: string;
  categoria: AccountId;
  cuenta: number;
}

export interface Prediction {
  categoria: AccountId;
  /** Entero 0–100: posterior normalizada entre las categorías con evidencia. */
  confianza: number;
  /** Veces que el comercio de esta transacción se confirmó en esta categoría. */
  evidenciaComercio: number;
}

/** El comercio vale por tres palabras: es el rasgo que más dice. */
const MERCHANT_WEIGHT = 3;
/** Por debajo, mejor «sin clasificar» que un error con cara de certeza. */
export const CONFIDENCE_THRESHOLD = 60;
/** El comercio tiene que haberse confirmado al menos dos veces. */
export const MIN_MERCHANT_EVIDENCE = 2;
const SUAVIZADO = 1;

/**
 * Rasgos: la clave de comercio y cada palabra de la descripción limpia.
 *
 * El monto no entra. Se probó como orden de magnitud y solo repartía masa
 * entre todas las categorías (todas tienen compras de decenas de miles),
 * bajando la confianza de aciertos claros. Comercio y palabras bastan.
 */
export function featuresOf(hechos: { comercio: string; descripcion: string }): string[] {
  return [
    `comercio:${hechos.comercio}`,
    ...tokensOf(hechos.descripcion).map((t) => `palabra:${t}`),
  ];
}

/** Lo que el modelo entero sabe, aparte de las evidencias que tocan a la consulta. */
export interface ModelTotals {
  /** Suma de conteos por categoría. Define el prior y el denominador. */
  totales: ReadonlyMap<AccountId, number>;
  /** Rasgos distintos con evidencia. */
  vocabulario: number;
}

function pesoDe(feature: string): number {
  return feature.startsWith('comercio:') ? MERCHANT_WEIGHT : 1;
}

/**
 * Naive Bayes multinomial con suavizado de Laplace.
 *
 * Para cada categoría con evidencia: log P(c) + Σ peso(f) · log P(f|c), con
 * P(f|c) = (n(f,c) + 1) / (n(c) + V). `n(c)` y `V` vienen del modelo entero
 * (`totales`), no de las evidencias filtradas por la consulta: calcularlos
 * con el subconjunto infla a las categorías que solo comparten un rasgo y
 * hunde la confianza de aciertos claros (se vio en la muestra etiquetada).
 * La confianza es la posterior normalizada entre todas las categorías.
 */
export function predict(
  evidencias: readonly Evidence[],
  features: readonly string[],
  modelo: ModelTotals,
): Prediction | null {
  const total = [...modelo.totales.values()].reduce((s, n) => s + n, 0);
  if (total === 0) return null;

  const porCategoria = new Map<AccountId, Map<string, number>>();
  for (const e of evidencias) {
    if (e.cuenta <= 0) continue;
    const mapa = porCategoria.get(e.categoria) ?? new Map<string, number>();
    mapa.set(e.feature, (mapa.get(e.feature) ?? 0) + e.cuenta);
    porCategoria.set(e.categoria, mapa);
  }

  const V = Math.max(1, modelo.vocabulario);
  const puntajes: { categoria: AccountId; log: number }[] = [];
  for (const [categoria, nC] of modelo.totales) {
    if (nC <= 0) continue;
    const rasgos = porCategoria.get(categoria);
    let log = Math.log(nC / total);
    for (const f of features) {
      const nFC = rasgos?.get(f) ?? 0;
      log += pesoDe(f) * Math.log((nFC + SUAVIZADO) / (nC + SUAVIZADO * V));
    }
    puntajes.push({ categoria, log });
  }
  if (puntajes.length === 0) return null;

  const maximo = Math.max(...puntajes.map((p) => p.log));
  const pesos = puntajes.map((p) => ({ ...p, peso: Math.exp(p.log - maximo) }));
  const suma = pesos.reduce((s, p) => s + p.peso, 0);
  const mejor = pesos.reduce((m, p) => (p.peso > m.peso ? p : m));
  const comercio = features.find((f) => f.startsWith('comercio:'));
  return {
    categoria: mejor.categoria,
    confianza: Math.round((mejor.peso / suma) * 100),
    evidenciaComercio:
      comercio === undefined ? 0 : (porCategoria.get(mejor.categoria)?.get(comercio) ?? 0),
  };
}

export function shouldApply(p: Prediction): boolean {
  return p.confianza >= CONFIDENCE_THRESHOLD && p.evidenciaComercio >= MIN_MERCHANT_EVIDENCE;
}
