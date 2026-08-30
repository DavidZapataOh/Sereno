import { create } from 'zustand';

import type { SyncSummary } from '@/application/sync/sync-portal';

interface LastSyncState {
  summary: SyncSummary | null;
  set: (summary: SyncSummary) => void;
  clear: () => void;
}

/** El resumen de la última importación, para mostrarlo donde se usa: en Movimientos. */
export const useLastSyncStore = create<LastSyncState>((set) => ({
  summary: null,
  set: (summary) => {
    set({ summary });
  },
  clear: () => {
    set({ summary: null });
  },
}));
