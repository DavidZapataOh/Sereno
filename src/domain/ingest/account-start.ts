import { calendarDay, parsePortalDate } from '@/domain/time/colombia';

import type { IngestRun } from './ingest-run';

/**
 * Sereno empieza a contar el día en que se conecta la cuenta.
 *
 * El saldo del banco es el punto de partida; los movimientos anteriores a ese
 * día no entran al ledger. Lo pidió el usuario en la sesión de campo, con
 * razón: una cuenta de ocho años trae historia que no sirve para nada aquí y
 * sí hace daño —un retiro de hace dos semanas ponía 40.000 en Efectivo que
 * ya no existían—. Lo que había antes está resumido en el saldo inicial.
 *
 * El inicio es el **día calendario** de la primera corrida de esa fuente, no
 * el instante: el banco fecha los movimientos por día, así que un movimiento
 * del día de inicio entra siempre (en la primera corrida lo compensa el saldo
 * inicial; en las siguientes es nuevo y se concilia).
 */
export function startDayOf(firstRun: IngestRun | null, now: string): string {
  return calendarDay(firstRun?.iniciadoEn ?? now);
}

const FORMATO_PORTAL = /^\d{4}\/\d{1,2}\/\d{1,2}$/;

/**
 * ¿Este movimiento es de antes del inicio y por tanto no cuenta?
 *
 * La fecha llega como la trae la fuente: `AAAA/MM/DD` del portal, o ISO. La
 * del portal se convierte con el mismo parser que usa el ledger; pasarla a
 * `Date` a pelo la interpretaría en la zona horaria de la máquina, y en UTC
 * el 28 se vuelve 27. Lo cazó CI. Una fecha ilegible no es «anterior»: se
 * deja pasar para que la conversión al ledger la reporte como omitida.
 */
export function isBeforeStart(fecha: string, inicio: string): boolean {
  try {
    const iso = FORMATO_PORTAL.test(fecha) ? parsePortalDate(fecha) : fecha;
    return calendarDay(iso) < inicio;
  } catch {
    return false;
  }
}
