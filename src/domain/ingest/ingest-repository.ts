import type { OwnerId, TransactionId } from '@/domain/ledger/ids';

import type { IngestRun } from './ingest-run';
import type { Observation } from './observation';

export interface IngestRepository {
  saveRun: (run: IngestRun) => Promise<void>;
  findLastRun: (owner: OwnerId, fuente: string) => Promise<IngestRun | null>;
  saveObservation: (observation: Observation) => Promise<void>;
  findObservationByOrigin: (
    owner: OwnerId,
    fuente: string,
    referencia: string,
  ) => Promise<Observation | null>;
  /** Todas las observaciones cuya huella sea una de las dadas. Base del plan 02. */
  findObservationsByFingerprint: (owner: OwnerId, huellas: string[]) => Promise<Observation[]>;
  listObservations: (transactionId: TransactionId) => Promise<Observation[]>;
  deleteObservation: (id: string) => Promise<void>;
}
