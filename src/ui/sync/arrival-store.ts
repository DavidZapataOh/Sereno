import { create } from 'zustand';

interface Llegada {
  /** Cuántos movimientos entraron en la última traída. */
  nuevos: number;
  /** Cuándo pasó, para no repetir la ceremonia al volver a la pestaña. */
  cuando: string;
}

interface ArrivalState {
  llegada: Llegada | null;
  anunciar: (nuevos: number, cuando: string) => void;
  cerrar: () => void;
}

/**
 * Lo que entró esta mañana, hasta que se mire.
 *
 * Vive en memoria a propósito: es un momento, no un dato. Si la app se cierra
 * antes de verlo, se perdió —y el movimiento sigue en la lista, que es donde
 * de verdad importa—.
 */
export const useArrivalStore = create<ArrivalState>((set) => ({
  llegada: null,
  anunciar: (nuevos, cuando) => {
    set({ llegada: nuevos > 0 ? { nuevos, cuando } : null });
  },
  cerrar: () => {
    set({ llegada: null });
  },
}));
