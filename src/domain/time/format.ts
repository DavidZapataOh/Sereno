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
