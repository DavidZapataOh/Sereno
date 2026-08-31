import type { OwnerId } from '@/domain/ledger/ids';

import type { Snapshot } from './snapshot';

export interface SnapshotRepository {
  /** Guarda la del día. Si ya había una de ese día, la reemplaza. */
  guardar: (instantanea: Snapshot) => Promise<void>;
  /** Las del rango, en orden. Un día sin instantánea **no aparece**. */
  serie: (owner: OwnerId, desde: string, hasta: string) => Promise<Snapshot[]>;
}
