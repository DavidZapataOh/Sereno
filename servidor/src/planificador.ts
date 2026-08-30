import type { Observabilidad } from './observabilidad';

export interface OpcionesPlanificador {
  intervaloMs: number;
  tarea: () => Promise<void>;
  observabilidad: Observabilidad;
}

/**
 * Corre una tarea cada tanto, sin solaparse y sin morirse.
 *
 * Se programa **después** de que la pasada termine, no cada N milisegundos
 * pase lo que pase: si una lectura tarda más que el intervalo, encadenar
 * pasadas encima solo empeora las cosas. Y un fallo no rompe el ciclo: se
 * registra y se vuelve a intentar, que es justo lo que se le pide.
 */
export function crearPlanificador(opciones: OpcionesPlanificador): {
  arrancar: () => void;
  parar: () => void;
} {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let vivo = false;

  const vuelta = async (): Promise<void> => {
    try {
      await opciones.tarea();
    } catch (error) {
      opciones.observabilidad.captureError(error, { operacion: 'pasada-de-ingesta' });
    }
    if (vivo) {
      temporizador = setTimeout(() => {
        void vuelta();
      }, opciones.intervaloMs);
    }
  };

  return {
    arrancar: () => {
      if (vivo) return;
      vivo = true;
      void vuelta();
    },
    parar: () => {
      vivo = false;
      if (temporizador !== null) clearTimeout(temporizador);
      temporizador = null;
    },
  };
}
