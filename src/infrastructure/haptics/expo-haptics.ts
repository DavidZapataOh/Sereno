import type { Haptics, Vibracion } from '@/domain/feedback/haptics-port';

/** Los nombres del módulo, escritos a mano para no importarlo arriba. */
interface ModuloHaptics {
  notificationAsync: (tipo: string) => Promise<void>;
  impactAsync: (estilo: string) => Promise<void>;
  NotificationFeedbackType: { Success: string; Error: string };
  ImpactFeedbackStyle: { Light: string };
}

/**
 * La háptica del sistema.
 *
 * **Se carga dentro de la función y entre `try`**, no arriba del archivo. Es la
 * lección de `expo-notifications` del sprint 09: un módulo nativo que revienta
 * al importarse tumba la app entera al arrancar, y ninguna prueba lo ve porque
 * en Jest está doblado. Si no está disponible, no vibra y ya.
 *
 * Y **nunca lanza**: que el teléfono no pueda vibrar no es un error que deba
 * llegar a ninguna parte.
 */
export function createExpoHaptics(): Haptics {
  const cargar = (): ModuloHaptics | null => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('expo-haptics') as ModuloHaptics;
    } catch {
      return null;
    }
  };

  return {
    sentir: (que: Vibracion) => {
      const modulo = cargar();
      if (modulo === null) return;

      try {
        if (que === 'confirmar') {
          void modulo.notificationAsync(modulo.NotificationFeedbackType.Success);
        } else if (que === 'fallo') {
          void modulo.notificationAsync(modulo.NotificationFeedbackType.Error);
        } else {
          void modulo.impactAsync(modulo.ImpactFeedbackStyle.Light);
        }
      } catch {
        // Vibrar es un extra. Que falle no puede afectar a nada.
      }
    },
  };
}
