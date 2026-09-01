import type { Obligation } from '@/domain/calendar/obligation';

import type { ReminderSettings } from './reminder-settings';

export interface Reminder {
  /** Estable: reprogramar dos veces no duplica el aviso. */
  id: string;
  /** Cuándo dispararlo, ISO con zona. */
  cuando: string;
  titulo: string;
  cuerpo: string;
}

const TEXTO: Record<Obligation['origen'], string> = {
  tarjeta: 'Se acerca el pago de tu tarjeta',
  suscripcion: 'Te van a cobrar una suscripción',
  cuota: 'Se acerca una cuota',
};

/**
 * Los avisos que corresponden a lo que está por vencer.
 *
 * **Ningún monto en el texto.** Una notificación se lee en la pantalla de
 * bloqueo, delante de quien pase: decir ahí cuánto se debe es enseñarle la
 * deuda a cualquiera. El monto está dentro de la app, que es donde importa.
 *
 * Lo ya pagado no genera aviso, y lo que caería en el pasado se descarta en vez
 * de dispararse al abrir: un aviso de algo que ya ocurrió es ruido, y el ruido
 * es lo que hace que se dejen de mirar todos los demás.
 */
export function recordatoriosDe(
  obligaciones: readonly Obligation[],
  ajustes: ReminderSettings,
  ahora: string,
): Reminder[] {
  if (ajustes.silenciado) return [];

  const avisos: Reminder[] = [];
  for (const o of obligaciones) {
    if (o.estado === 'pagada') continue;

    const cuando = restarDias(o.vence, ajustes.diasAntes, ajustes.hora);
    if (cuando <= ahora) continue;

    avisos.push({
      id: `aviso:${o.id}`,
      cuando,
      titulo: TEXTO[o.origen],
      cuerpo: `${o.nombre} · vence el ${diaLegible(o.vence)}`,
    });
  }
  return avisos;
}

/** La fecha `dias` antes, a la hora dada, en hora de Colombia. */
function restarDias(dia: string, dias: number, hora: number): string {
  const base = Date.parse(`${dia}T12:00:00.000-05:00`) - dias * 86_400_000;
  const fecha = new Date(base);
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const d = String(fecha.getUTCDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}T${String(hora).padStart(2, '0')}:00:00.000-05:00`;
}

function diaLegible(dia: string): string {
  const [, mes = '01', d = '01'] = dia.split('-');
  return `${String(Number(d))}/${String(Number(mes))}`;
}
