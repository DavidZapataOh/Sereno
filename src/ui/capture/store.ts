import { create } from 'zustand';
import { parseSerenoMessage } from '@/domain/capture/protocol';
import { CaptureReassembler, type Capture } from '@/domain/capture/reassembler';

interface CaptureState {
  captures: Capture[];
  /** Mensajes que no cumplieron el protocolo. Señal de que algo va mal. */
  descartados: number;
  handleMessage: (raw: string) => void;
  clear: () => void;
}

/**
 * Estado de la sesión de captura.
 *
 * El reensamblador vive dentro del store y se reemplaza en `clear`, en vez de
 * ser una instancia de módulo. Uno global conservaría fragmentos entre sesiones
 * —y entre pruebas—, produciendo capturas que mezclan dos respuestas distintas.
 */
export const useCaptureStore = create<CaptureState>((set) => {
  let reassembler = new CaptureReassembler();

  return {
    captures: [],
    descartados: 0,

    handleMessage: (raw) => {
      const message = parseSerenoMessage(raw);
      if (message === null) {
        set((state) => ({ descartados: state.descartados + 1 }));
        return;
      }
      const capture = reassembler.accept(message);
      if (capture === null) return;
      set((state) => ({ captures: [...state.captures, capture] }));
    },

    clear: () => {
      reassembler = new CaptureReassembler();
      set({ captures: [], descartados: 0 });
    },
  };
});
