import { recordatoriosDe } from '@/domain/alerts/reminder';
import type { ReminderSettings } from '@/domain/alerts/reminder-settings';
import type { OwnerId } from '@/domain/ledger/ids';
import { calendarDay } from '@/domain/time/colombia';

import { paymentCalendar, type CalendarDeps } from '../calendar/payment-calendar';

/** El puerto del planificador. La infraestructura lo implementa. */
export interface Scheduler {
  pedirPermiso: () => Promise<boolean>;
  cancelarTodo: () => Promise<void>;
  programar: (
    avisos: readonly { id: string; cuando: string; titulo: string; cuerpo: string }[],
  ) => Promise<number>;
}

export interface RescheduleDeps extends CalendarDeps {
  scheduler: Scheduler;
  ajustesDeAviso: ReminderSettings;
}

export interface ResumenAvisos {
  programados: number;
  motivo: 'ok' | 'sin-permiso' | 'silenciado';
}

/** Cuánto por delante se programa. Más allá, el calendario cambia igual. */
const MESES_POR_DELANTE = 2;

/**
 * Cancela todos los avisos y los vuelve a programar desde el calendario.
 *
 * **Se reprograma entero, en vez de guardar qué se programó.** En Android los
 * avisos no sobreviven a un reinicio del teléfono: el sistema los olvida y la
 * app no se entera. Guardar «ya programé el del día 15» sería creer estar
 * cubierto sin estarlo, que es peor que no tener avisos.
 *
 * Y tiene una propiedad que la alternativa no: si algo se paga, el siguiente
 * arranque quita su aviso solo, porque el calendario ya no lo trae. El estado
 * del sistema siempre coincide con el de la contabilidad.
 */
export async function rescheduleReminders(
  deps: RescheduleDeps,
  input: { owner: OwnerId },
): Promise<ResumenAvisos> {
  if (deps.ajustesDeAviso.silenciado) {
    // Silenciado cancela lo que hubiera: si no, quedarían sonando los de antes.
    await deps.scheduler.cancelarTodo();
    return { programados: 0, motivo: 'silenciado' };
  }

  if (!(await deps.scheduler.pedirPermiso())) {
    return { programados: 0, motivo: 'sin-permiso' };
  }

  const hoy = calendarDay(deps.clock());
  const obligaciones = await paymentCalendar(deps, {
    owner: input.owner,
    desde: hoy,
    hasta: mesesDespues(hoy, MESES_POR_DELANTE),
  });

  await deps.scheduler.cancelarTodo();
  const programados = await deps.scheduler.programar(
    recordatoriosDe(obligaciones, deps.ajustesDeAviso, deps.clock()),
  );
  return { programados, motivo: 'ok' };
}

function mesesDespues(dia: string, n: number): string {
  const [anio = 1970, mes = 1, d = 1] = dia.split('-').map(Number);
  const total = (anio - 1) * 12 + (mes - 1) + n;
  return `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
