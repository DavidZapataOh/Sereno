import type { Scheduler } from '@/application/alerts/reschedule-reminders';
import type { Reminder } from '@/domain/alerts/reminder';

/**
 * Programar avisos en el teléfono.
 *
 * **`expo-notifications` se carga tarde y entre `try`, nunca arriba.**
 *
 * La documentación de Expo dice que los avisos locales siguen disponibles en
 * Expo Go, y es verdad a medias: **el módulo revienta al importarse** en
 * Android bajo Expo Go desde SDK 53, antes de que nadie llegue a usar nada. Un
 * `import` normal aquí tumba la app entera al arrancar —pasó el 2026-09-01,
 * con todas las rutas cayendo por un módulo que ninguna pantalla usaba—.
 *
 * Cargarlo dentro de una función y capturar el fallo convierte «no hay avisos»
 * en un estado que se enseña, en vez de en una app que no abre. En un
 * development build el módulo carga y todo funciona; en Expo Go la app va
 * igual, y la pantalla de Recordatorios lo dice.
 */
/**
 * Solo lo que se usa de `expo-notifications`.
 *
 * Se escribe a mano en vez de sacarlo del módulo con `typeof import(...)`
 * porque **ni siquiera el tipo puede referenciarlo desde la cabecera**: el
 * proyecto prohíbe las anotaciones `import()`, y traerlo con un `import type`
 * arriba invita a que alguien lo convierta en un import normal sin darse cuenta
 * —que es exactamente lo que tumbó la app—.
 */
interface ModuloDeAvisos {
  getPermissionsAsync: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  scheduleNotificationAsync: (peticion: {
    identifier: string;
    content: { title: string; body: string };
    trigger: { type: string; date: Date };
  }) => Promise<string>;
  SchedulableTriggerInputTypes: { DATE: string };
}

/** `null` cuando el entorno no lo soporta. Se intenta una sola vez. */
let modulo: ModuloDeAvisos | null | undefined;

function cargar(): ModuloDeAvisos | null {
  if (modulo !== undefined) return modulo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    modulo = require('expo-notifications') as ModuloDeAvisos;
  } catch {
    modulo = null;
  }
  return modulo;
}

export function createLocalScheduler(): Scheduler {
  return {
    pedirPermiso: async () => {
      const avisos = cargar();
      if (avisos === null) return false;
      try {
        const actual = await avisos.getPermissionsAsync();
        if (actual.granted) return true;
        // `canAskAgain` en falso significa que el usuario dijo que no y Android
        // ya no vuelve a preguntar: insistir abriría un diálogo que no aparece.
        if (!actual.canAskAgain) return false;
        return (await avisos.requestPermissionsAsync()).granted;
      } catch {
        return false;
      }
    },

    cancelarTodo: async () => {
      const avisos = cargar();
      if (avisos === null) return;
      try {
        await avisos.cancelAllScheduledNotificationsAsync();
      } catch {
        // Un fallo del sistema no puede tumbar el arranque de la app.
      }
    },

    programar: async (lista: readonly Reminder[]) => {
      const avisos = cargar();
      if (avisos === null) return 0;

      let programados = 0;
      for (const aviso of lista) {
        try {
          await avisos.scheduleNotificationAsync({
            identifier: aviso.id,
            content: { title: aviso.titulo, body: aviso.cuerpo },
            trigger: {
              type: avisos.SchedulableTriggerInputTypes.DATE,
              date: new Date(aviso.cuando),
            },
          });
          programados += 1;
        } catch {
          // Uno que falla no impide programar los demás.
        }
      }
      return programados;
    },
  };
}
