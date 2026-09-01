import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { subtract, zero, type Money } from '@/domain/money/money';

/**
 * Un gasto que no llega todos los meses: el impuesto, el seguro, la matrícula.
 *
 * El fondo es una **cuenta de activo**, no de patrimonio: `isRealAccount` solo
 * cuenta activos y pasivos, así que un fondo de patrimonio quedaría fuera del
 * total y apartar plata **haría bajar el patrimonio**. Apartar es mover de un
 * bolsillo a otro, y el patrimonio no se entera.
 */
/**
 * Para qué se aparta.
 *
 * **Un objetivo de ahorro es lo mismo que un fondo, con otra intención.** El
 * cálculo es idéntico —cuánto apartar cada mes para llegar a un monto en una
 * fecha—, así que comparten estructura en vez de duplicarla: es lo que el sprint
 * 08 hizo con las wallets y el exchange, y funcionó.
 *
 * Lo que cambia es qué significan: un **gasto** va a llegar sí o sí y se repite;
 * una **meta** es algo que se decide querer, y no se repite.
 */
export type TipoDeFondo = 'gasto' | 'meta';

export interface SinkingFund {
  accountId: AccountId;
  owner: OwnerId;
  nombre: string;
  tipo: TipoDeFondo;
  /** Cuánto va a costar cuando llegue, o cuánto se quiere reunir. */
  objetivo: Money;
  /** El día del cobro o de la meta, `AAAA-MM-DD`. */
  proximaFecha: string;
  /**
   * Cada cuántos meses se repite. `null` cuando no se repite —una meta—, que
   * **no es lo mismo que cero**: cero no significaría nada.
   */
  cadaMeses: number | null;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export function createSinkingFund(input: SinkingFund): SinkingFund {
  const nombre = input.nombre.trim();
  if (nombre.length === 0) throw new Error('El fondo necesita un nombre');
  if (input.objetivo.amount <= 0n) throw new Error('El objetivo tiene que ser positivo');
  if (!DIA.test(input.proximaFecha)) {
    throw new Error(`Una fecha se escribe AAAA-MM-DD, no "${input.proximaFecha}"`);
  }
  if (input.cadaMeses !== null && (!Number.isInteger(input.cadaMeses) || input.cadaMeses < 1)) {
    throw new Error('La repetición son meses enteros, y al menos uno');
  }
  if (input.tipo === 'meta' && input.cadaMeses !== null) {
    // Una meta que se repite sola no es una meta: es un gasto recurrente.
    throw new Error('Una meta no se repite: déjala sin repetición');
  }
  return { ...input, nombre };
}

/** Cuántos meses faltan hasta el cobro, contando el mes en curso. */
export function mesesHasta(fecha: string, hoy: string): number {
  const [a1 = 0, m1 = 1] = hoy.slice(0, 7).split('-').map(Number);
  const [a2 = 0, m2 = 1] = fecha.slice(0, 7).split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/**
 * Cuánto hay que apartar este mes.
 *
 * Lo que falta, repartido entre los meses que quedan. **El mes del cobro pide
 * todo lo que falte**: ahí ya no hay margen, y un aporte «suavizado» engañaría
 * justo cuando importa.
 */
export function aporteMensual(fondo: SinkingFund, apartado: Money, hoy: string): Money {
  const falta = subtract(fondo.objetivo, apartado);
  if (falta.amount <= 0n) return zero(fondo.objetivo.currency);

  const meses = mesesHasta(fondo.proximaFecha, hoy);
  // Vencido o este mismo mes: hace falta todo ahora.
  if (meses <= 0) return falta;

  // Redondeo hacia arriba: quedarse corto deja el fondo sin completar el último
  // mes, que es cuando ya no se puede reaccionar.
  const porMes = (falta.amount + BigInt(meses)) / BigInt(meses + 1);
  return { amount: porMes < 1n ? falta.amount : porMes, currency: falta.currency };
}

/** Si con ese aporte el fondo llega completo a tiempo. */
export function alcanzaATiempo(
  fondo: SinkingFund,
  apartado: Money,
  aporte: Money,
  hoy: string,
): boolean {
  const meses = mesesHasta(fondo.proximaFecha, hoy);
  if (meses < 0) return apartado.amount >= fondo.objetivo.amount;
  return apartado.amount + aporte.amount * BigInt(meses + 1) >= fondo.objetivo.amount;
}

/**
 * Si se va adelantado, al día o atrasado respecto a lo que tocaba a esta altura.
 *
 * «Al día» tolera unos pesos: exigir el céntimo exacto haría que nunca lo
 * estuviera, y un estado que no se alcanza nunca no informa de nada.
 */
export type Ritmo = { estado: 'adelantado' | 'al-dia' | 'atrasado'; diferencia: Money };

/** Lo que se tolera para seguir considerándose «al día». */
const HOLGURA = 1_000n;

export function ritmoDe(fondo: SinkingFund, apartado: Money, hoy: string, desde: string): Ritmo {
  const totales = mesesHasta(fondo.proximaFecha, desde) + 1;
  // Meses **cumplidos**, no empezados: el aporte de un mes se hace durante el
  // mes. Contar el mes en curso como vencido diría «atrasado» el mismo día de
  // crear la meta, cuando todavía no había nada que aportar.
  const transcurridos = mesesHasta(hoy, desde);
  if (totales <= 0) {
    return { estado: 'al-dia', diferencia: zero(fondo.objetivo.currency) };
  }

  const tocaba =
    (fondo.objetivo.amount * BigInt(Math.max(0, Math.min(transcurridos, totales)))) /
    BigInt(totales);
  const diferencia: Money = { amount: apartado.amount - tocaba, currency: fondo.objetivo.currency };

  if (diferencia.amount > HOLGURA) return { estado: 'adelantado', diferencia };
  if (diferencia.amount < -HOLGURA) return { estado: 'atrasado', diferencia };
  return { estado: 'al-dia', diferencia };
}

/**
 * El siguiente ciclo: un seguro pagado en mayo vuelve a apuntar a mayo.
 *
 * Una **meta no se reproyecta**: cuando se cumple, se cumplió.
 */
export function siguienteCiclo(fondo: SinkingFund): SinkingFund {
  if (fondo.cadaMeses === null) return fondo;
  const [anio = 1970, mes = 1, dia = 1] = fondo.proximaFecha.split('-').map(Number);
  const total = (anio - 1) * 12 + (mes - 1) + fondo.cadaMeses;
  const proximaFecha = `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return { ...fondo, proximaFecha };
}
