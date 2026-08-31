import { calendarDay, daysBetween } from './colombia';

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function partes(iso: string): { dia: number; mes: number; anio: number } {
  const [anio, mes, dia] = calendarDay(iso).split('-').map(Number);
  return { dia: dia ?? 1, mes: (mes ?? 1) - 1, anio: anio ?? 1970 };
}

/** «28 ago». Sin `Intl`: el formato no depende del dispositivo. */
export function formatShortDate(iso: string): string {
  const p = partes(iso);
  return `${String(p.dia)} ${MESES_CORTOS[p.mes] ?? ''}`;
}

/** «28 de agosto de 2026». */
/** «Agosto de 2026»: el mes de Colombia al que pertenece el instante. */
export function formatMonthYear(iso: string): string {
  const p = partes(iso);
  const mes = MESES_LARGOS[p.mes] ?? '';
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${String(p.anio)}`;
}

export function formatLongDate(iso: string): string {
  const p = partes(iso);
  return `${String(p.dia)} de ${MESES_LARGOS[p.mes] ?? ''} de ${String(p.anio)}`;
}

/** «hace 3 h». Pasados siete días, la fecha corta: «hace 23 días» no ayuda. */
export function formatRelative(iso: string, now: string): string {
  const ms = Math.max(0, Date.parse(now) - Date.parse(iso));
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'justo ahora';
  if (min < 60) return `hace ${String(min)} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${String(horas)} h`;
  const dias = daysBetween(iso, now);
  if (dias < 7) return `hace ${String(dias)} ${dias === 1 ? 'día' : 'días'}`;
  return formatShortDate(iso);
}

/**
 * «hoy», «mañana», «en 5 días», o la fecha corta si falta mucho.
 *
 * `formatRelative` no sirve para esto: recorta a cero las diferencias
 * negativas, así que cualquier fecha futura le sale «justo ahora».
 *
 * El caso de «hoy» es el que importa. Un aviso que dice «mañana» el mismo día
 * del cobro es la forma más fácil de perder la confianza del usuario en todo
 * lo demás que dice la app.
 */
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El día calendario de un valor que puede ser un instante ISO **o** ya un día.
 *
 * `calendarDay('2026-08-31')` devuelve el 30: la cadena sin hora se lee como
 * medianoche UTC, y al pasarla a Colombia cae al día anterior. Es el mismo
 * error que costó un hallazgo en el sprint 04, y aquí haría que el aviso del
 * día del cobro dijera «mañana».
 */
function diaCalendario(valor: string): string {
  return SOLO_DIA.test(valor) ? valor : calendarDay(valor);
}

/** Mediodía UTC del día: comparar así no depende de la zona ni del horario. */
function mediodia(dia: string): number {
  return Date.parse(`${dia}T12:00:00.000Z`);
}

/**
 * «hoy», «mañana», «en 5 días», o la fecha corta si falta mucho.
 *
 * `formatRelative` no sirve para esto: recorta a cero las diferencias
 * negativas, así que cualquier fecha futura le sale «justo ahora».
 *
 * El caso de «hoy» es el que importa. Un aviso que dice «mañana» el mismo día
 * del cobro es la forma más fácil de perder la confianza del usuario en todo
 * lo demás que dice la app.
 */
export function formatUpcoming(iso: string, now: string): string {
  const dia = diaCalendario(iso);
  const hoy = diaCalendario(now);
  if (dia === hoy) return 'hoy';

  const fecha = `${dia}T12:00:00.000-05:00`;
  if (dia < hoy) return formatShortDate(fecha);

  const dias = Math.round((mediodia(dia) - mediodia(hoy)) / 86_400_000);
  if (dias === 1) return 'mañana';
  if (dias < 7) return `en ${String(dias)} días`;
  return `el ${formatShortDate(fecha)}`;
}
