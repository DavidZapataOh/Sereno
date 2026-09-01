import * as Notifications from 'expo-notifications';

import type { Reminder } from '@/domain/alerts/reminder';

/**
 * Programar avisos en el teléfono.
 *
 * **Solo locales.** Leer las notificaciones de otras apps es el sprint 06b,
 * necesita código nativo y un APK; esto no: la documentación de Expo SDK 57
 * dice que el push remoto no va en Expo Go en Android desde SDK 53, pero «local
 * notifications remain available in Expo Go».
 */
export interface Scheduler {
  pedirPermiso: () => Promise<boolean>;
  cancelarTodo: () => Promise<void>;
  programar: (avisos: readonly Reminder[]) => Promise<number>;
}

export function createLocalScheduler(): Scheduler {
  return {
    pedirPermiso: async () => {
      const actual = await Notifications.getPermissionsAsync();
      if (actual.granted) return true;
      // `canAskAgain` en falso significa que el usuario dijo que no y Android
      // ya no vuelve a preguntar: insistir abriría un diálogo que no aparece.
      if (!actual.canAskAgain) return false;
      return (await Notifications.requestPermissionsAsync()).granted;
    },

    cancelarTodo: () => Notifications.cancelAllScheduledNotificationsAsync(),

    programar: async (avisos) => {
      let programados = 0;
      for (const aviso of avisos) {
        await Notifications.scheduleNotificationAsync({
          identifier: aviso.id,
          content: { title: aviso.titulo, body: aviso.cuerpo },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(aviso.cuando),
          },
        });
        programados += 1;
      }
      return programados;
    },
  };
}
