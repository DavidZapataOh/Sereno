import type { Money } from '@/domain/money/money';

/**
 * Una medida de conducta, no una nota.
 *
 * `queLaMueve` no es adorno: un número solo —«tu tasa de ahorro es 12 %»— no
 * dice qué hacer, y una métrica que no se puede accionar es un adorno. Si no se
 * puede escribir qué la movería, la métrica no entra.
 */
export interface Metrica {
  clave: string;
  valor: number;
  unidad: 'dias' | 'porcentaje' | 'meses' | 'veces';
  /** Sobre cuántos meses se calculó. Uno no es un promedio. */
  meses: number;
  queLaMueve: string;
}

/** Con menos de esto, cualquier cifra es ruido presentado como hecho. */
export const MESES_MINIMOS = 2;

export interface MovimientoDeCaja {
  /** `AAAA-MM-DD`. */
  dia: string;
  monto: Money;
}

/**
 * Cuántos días lleva en la cuenta el dinero que se está gastando.
 *
 * La idea de YNAB, y la más útil de las cuatro: si lo que se gasta hoy entró
 * hace treinta días, no se vive al día. Se mide con una cola **FIFO** —cada
 * peso que sale es el peso más viejo que entró— y se promedia la edad de lo
 * gastado.
 *
 * `null` sin historia suficiente. Un número respaldado por dos semanas,
 * presentado como un hecho, es peor que un hueco: quien lo lee no tiene por qué
 * sospechar de él.
 */
export function antiguedadDelDinero(
  entradas: readonly MovimientoDeCaja[],
  salidas: readonly MovimientoDeCaja[],
  meses: number,
): Metrica | null {
  if (meses < MESES_MINIMOS || entradas.length === 0 || salidas.length === 0) return null;

  const cola = entradas
    .map((e) => ({ dia: e.dia, queda: e.monto.amount }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
  const gastos = [...salidas].sort((a, b) => a.dia.localeCompare(b.dia));

  let diasPonderados = 0n;
  let gastadoConEdad = 0n;

  for (const gasto of gastos) {
    let porCubrir = gasto.monto.amount;
    for (const lote of cola) {
      if (porCubrir <= 0n) break;
      if (lote.queda <= 0n) continue;

      const usado = lote.queda < porCubrir ? lote.queda : porCubrir;
      lote.queda -= usado;
      porCubrir -= usado;
      diasPonderados += usado * BigInt(diasEntre(lote.dia, gasto.dia));
      gastadoConEdad += usado;
    }
    // Lo que no se pudo cubrir con entradas conocidas no tiene edad: no se
    // inventa una. Con la cola vacía, ese gasto simplemente no cuenta.
  }

  if (gastadoConEdad === 0n) return null;
  return {
    clave: 'antiguedad-del-dinero',
    valor: Number(diasPonderados / gastadoConEdad),
    unidad: 'dias',
    meses,
    queLaMueve: 'Sube si aumentas el colchón o si un mes gastas menos de lo que entra',
  };
}

/** Qué fracción de lo que entra se queda. Negativa cuando se gasta de más. */
export function tasaDeAhorro(ingreso: Money, gasto: Money, meses: number): Metrica | null {
  if (meses < MESES_MINIMOS || ingreso.amount <= 0n) return null;

  // No se recorta a cero: un mes en rojo es justo el que hay que ver.
  const guardado = ingreso.amount - gasto.amount;
  return {
    clave: 'tasa-de-ahorro',
    valor: Number((guardado * 1000n) / ingreso.amount) / 10,
    unidad: 'porcentaje',
    meses,
    queLaMueve: 'Sube bajando el gasto de una categoría grande, o subiendo el ingreso',
  };
}

/** Cuánto se aguanta si mañana se corta el ingreso. La que más tranquiliza. */
export function mesesDeColchon(saldo: Money, gastoMensual: Money, meses: number): Metrica | null {
  if (meses < MESES_MINIMOS || gastoMensual.amount <= 0n) return null;

  return {
    clave: 'meses-de-colchon',
    valor: Number((saldo.amount * 10n) / gastoMensual.amount) / 10,
    unidad: 'meses',
    meses,
    queLaMueve: 'Sube apartando cada mes, y baja cuando sube el gasto habitual',
  };
}

/** Cuánto de lo que se gana ya está comprometido. */
export function deudaSobreIngreso(deuda: Money, ingreso: Money, meses: number): Metrica | null {
  if (meses < MESES_MINIMOS || ingreso.amount <= 0n) return null;

  const cuanto = deuda.amount < 0n ? -deuda.amount : deuda.amount;
  return {
    clave: 'deuda-sobre-ingreso',
    valor: Number((cuanto * 10n) / ingreso.amount) / 10,
    unidad: 'veces',
    meses,
    queLaMueve: 'Baja pagando capital; pagar solo intereses no la mueve',
  };
}

/** Días entre dos fechas `AAAA-MM-DD`, nunca negativo. */
function diasEntre(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}
