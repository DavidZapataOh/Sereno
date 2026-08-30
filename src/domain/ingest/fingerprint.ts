import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { calendarDay } from '@/domain/time/colombia';

/** Prefijos con los que los bancos etiquetan el tipo de movimiento. Son ruido. */
const PREFIJOS_RUIDO =
  /^(compra|pago|abono|retiro|transferencia|consignacion)\b(\s+(pse|en|a|de))?\s*/;
/** Números de terminal o autorización, tipo «*4471». */
const TERMINALES = /\*\d+\s*/g;
const FORMATO_PORTAL = /^\d{4}\/\d{2}\/\d{2}$/;

/**
 * Descripción comparable entre fuentes.
 *
 * Dos fuentes describen la misma compra de formas distintas: «COMPRA PSE *4471
 * EXITO SUR» por la web, «Pago en EXITO SUR» por correo. Sin normalizar, la
 * deduplicación del plan 02 no puede reconocerlas.
 */
export function normalizeDescription(raw: string): string {
  const base = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  const limpia = base.replace(TERMINALES, '').replace(PREFIJOS_RUIDO, '').trim();
  // Si todo era ruido, mejor la base que una cadena vacía que empareje con todo.
  return limpia.length > 0 ? limpia : base;
}

/** El día `AAAA-MM-DD` de una transacción normalizada, venga en el formato que venga. */
export function dayOf(n: NormalizedTransaction): string {
  return FORMATO_PORTAL.test(n.fecha) ? n.fecha.replace(/\//g, '-') : calendarDay(n.fecha);
}

/**
 * Huella de una transacción normalizada: día en Colombia, monto y descripción
 * comparable. Es la clave por la que el plan 02 busca duplicados entre fuentes.
 */
export function fingerprintOf(n: NormalizedTransaction): string {
  return `${dayOf(n)}|${String(n.monto)}|${normalizeDescription(n.descripcion)}`;
}
