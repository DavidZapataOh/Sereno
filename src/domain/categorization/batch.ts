import type { AccountId, OwnerId, TransactionId } from '@/domain/ledger/ids';

import type { ClassificationSource } from './classification';

/** Lo que había antes de un cambio, suficiente para restaurarlo tal cual. */
export interface ClassificationSnapshot {
  categoria: AccountId;
  origen: ClassificationSource;
  reglaId: string | null;
  confianza: number;
}

export interface BatchChange {
  transactionId: TransactionId;
  /** `null`: estaba sin clasificar. */
  antes: ClassificationSnapshot | null;
  despues: AccountId;
}

/**
 * Un lote de revisión: qué se clasificó, desde qué, y la regla que se creó.
 * Deshacer es recorrerlo al revés. No se borra: queda como historial.
 */
export interface ClassificationBatch {
  id: string;
  owner: OwnerId;
  comercio: string;
  cambios: BatchChange[];
  reglaId: string | null;
  creadoEn: string;
  deshechoEn: string | null;
}

export interface BatchRepository {
  save: (batch: ClassificationBatch) => Promise<void>;
  findById: (id: string) => Promise<ClassificationBatch | null>;
  /** El más reciente que no se ha deshecho. */
  findLatest: (owner: OwnerId) => Promise<ClassificationBatch | null>;
}
