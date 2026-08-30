/**
 * Colombia usa UTC−5 todo el año: no hay horario de verano. Por eso la zona
 * se puede escribir como constante y no hace falta una base de datos de zonas.
 */
export const COLOMBIA_UTC_OFFSET = '-05:00';

const OFFSET_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const FORMATO_PORTAL = /^(\d{4})\/(\d{2})\/(\d{2})$/;

function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Interpreta una fecha `AAAA/MM/DD` del portal como medianoche en Colombia.
 *
 * Valida que la fecha exista: `new Date('2026-02-30')` devolvería el 2 de
 * marzo sin protestar, y un movimiento cambiaría de mes en silencio.
 */
export function parsePortalDate(raw: string): string {
  const coincidencia = FORMATO_PORTAL.exec(raw);
  if (coincidencia === null) {
    throw new Error(`Se esperaba una fecha AAAA/MM/DD y llegó "${raw}"`);
  }
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);

  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) {
    throw new Error(`La fecha ${raw} no existe`);
  }

  const mm = String(mes).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return `${String(anio)}-${mm}-${dd}T00:00:00.000${COLOMBIA_UTC_OFFSET}`;
}

function instante(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Fecha inválida: ${iso}`);
  return ms;
}

/** Día calendario `AAAA-MM-DD` en Colombia de cualquier instante ISO. */
export function calendarDay(iso: string): string {
  const enColombia = new Date(instante(iso) - OFFSET_MS);
  return enColombia.toISOString().slice(0, 10);
}

/** Días calendario entre dos instantes, en valor absoluto. */
export function daysBetween(a: string, b: string): number {
  const diaA = Math.floor((instante(a) - OFFSET_MS) / DIA_MS);
  const diaB = Math.floor((instante(b) - OFFSET_MS) / DIA_MS);
  return Math.abs(diaA - diaB);
}
