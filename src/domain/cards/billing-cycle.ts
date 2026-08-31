import { calendarDay } from '@/domain/time/colombia';

const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El día calendario de un instante, o el día tal cual si ya lo es.
 *
 * Cortar la cadena por los diez primeros caracteres funcionaría con las fechas
 * en hora de Colombia y fallaría con las que vienen en Z: un movimiento de las
 * 23:00 del día 30 llega como `2026-08-31T04:00:00Z` y caería en el ciclo
 * siguiente. Es el mismo error que costó un hallazgo en el sprint 04.
 */
export function diaDe(valor: string): string {
  return SOLO_DIA.test(valor) ? valor : calendarDay(valor);
}

/**
 * Un ciclo de facturación: entre un corte y el siguiente.
 *
 * El intervalo es **medio abierto**: incluye el día de corte y excluye el
 * corte siguiente. Sin esa regla escrita, una compra hecha el día del corte
 * cae en dos ciclos o en ninguno, según quién haga la comparación.
 */
export interface BillingCycle {
  /** Día en que abre el ciclo, `AAAA-MM-DD`. Incluido. */
  corte: string;
  /** Día en que abre el siguiente. Excluido de este. */
  siguienteCorte: string;
  /** Día en que vence el pago de este ciclo. */
  pago: string;
}

function dia(anio: number, mes: number, d: number): string {
  return `${String(anio).padStart(4, '0')}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Suma meses a un año/mes, normalizando el desbordamiento de diciembre. */
function sumarMeses(anio: number, mes: number, n: number): { anio: number; mes: number } {
  const total = anio * 12 + mes + n;
  return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
}

function partes(fecha: string): { anio: number; mes: number; d: number } {
  const [anio, mes, d] = diaDe(fecha).split('-').map(Number);
  return { anio: anio ?? 1970, mes: (mes ?? 1) - 1, d: d ?? 1 };
}

/**
 * El ciclo al que pertenece una fecha.
 *
 * El pago vence **después del corte que cierra el ciclo**: lo que se compra el
 * 20 de agosto cierra el 15 de septiembre y se paga el 5 de octubre. Ponerlo
 * en el mismo mes del corte adelanta la fecha un mes entero, que es el error
 * que hace que una app avise tarde.
 */
export function cicloDe(fecha: string, diaDeCorte: number, diaDePago: number): BillingCycle {
  const { anio, mes, d } = partes(fecha);
  // Antes del corte de este mes, el ciclo empezó el mes pasado.
  const inicio = d >= diaDeCorte ? { anio, mes } : sumarMeses(anio, mes, -1);
  const siguiente = sumarMeses(inicio.anio, inicio.mes, 1);
  // El pago cae después del corte que cierra: si el día de pago es anterior al
  // de corte, cae ya en el mes siguiente a ese cierre.
  const mesDePago =
    diaDePago >= diaDeCorte ? siguiente : sumarMeses(siguiente.anio, siguiente.mes, 1);

  return {
    corte: dia(inicio.anio, inicio.mes, diaDeCorte),
    siguienteCorte: dia(siguiente.anio, siguiente.mes, diaDeCorte),
    pago: dia(mesDePago.anio, mesDePago.mes, diaDePago),
  };
}

/**
 * Todos los ciclos que tocan el rango, en orden y sin huecos.
 *
 * Se generan encadenados —el corte de uno es el siguiente del anterior— en vez
 * de calcular cada uno por su cuenta: así la propiedad de «sin huecos ni
 * solapes» se cumple por construcción y no por casualidad.
 */
export function ciclosEntre(
  desde: string,
  hasta: string,
  diaDeCorte: number,
  diaDePago: number,
): BillingCycle[] {
  const ciclos: BillingCycle[] = [];
  let actual = cicloDe(desde, diaDeCorte, diaDePago);
  const fin = diaDe(hasta);
  // Tope de seguridad: cien años de ciclos es más de lo que cualquiera va a
  // pedir, y evita un bucle infinito si alguien pasa un rango al revés.
  for (let i = 0; i < 1200 && actual.corte <= fin; i += 1) {
    ciclos.push(actual);
    actual = cicloDe(actual.siguienteCorte, diaDeCorte, diaDePago);
  }
  return ciclos;
}

/** Si una fecha cae dentro del ciclo. Medio abierto: `[corte, siguienteCorte)`. */
export function contiene(ciclo: BillingCycle, fecha: string): boolean {
  const dia = diaDe(fecha);
  return dia >= ciclo.corte && dia < ciclo.siguienteCorte;
}

/**
 * Si una fecha cae en la ventana de pago del ciclo.
 *
 * Va del cierre —excluido, porque ese día abre el ciclo siguiente— al día del
 * pago, incluido. Un pago hecho antes del cierre es un abono anticipado y
 * pertenece al ciclo en curso, no a este.
 */
export function esPagoDelCiclo(ciclo: BillingCycle, fecha: string): boolean {
  const dia = diaDe(fecha);
  return dia >= ciclo.siguienteCorte && dia <= ciclo.pago;
}
