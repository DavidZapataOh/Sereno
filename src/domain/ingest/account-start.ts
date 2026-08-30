import { calendarDay } from '@/domain/time/colombia';

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

/** ¿Este movimiento es de antes del inicio y por tanto no cuenta? */
export function isBeforeStart(fecha: string, inicio: string): boolean {
  return calendarDay(fecha) < inicio;
}
