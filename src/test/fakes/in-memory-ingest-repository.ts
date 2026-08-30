import type { IngestRepository } from '@/domain/ingest/ingest-repository';
import type { IngestRun } from '@/domain/ingest/ingest-run';
import type { Observation } from '@/domain/ingest/observation';

export interface InMemoryIngestRepository extends IngestRepository {
  runs: () => IngestRun[];
  observations: () => Observation[];
}

export function createInMemoryIngestRepository(): InMemoryIngestRepository {
  const corridas = new Map<string, IngestRun>();
  const observaciones = new Map<string, Observation>();

  return {
    runs: () => [...corridas.values()],
    observations: () => [...observaciones.values()],

    saveRun: (run) => {
      corridas.set(run.id, { ...run });
      return Promise.resolve();
    },
    findLastRun: (owner, fuente) =>
      Promise.resolve(
        [...corridas.values()]
          .filter((r) => r.owner === owner && r.fuente === fuente)
          .sort((a, b) => b.iniciadoEn.localeCompare(a.iniciadoEn))[0] ?? null,
      ),
    findFirstRun: (owner, fuente) =>
      Promise.resolve(
        [...corridas.values()]
          .filter((r) => r.owner === owner && r.fuente === fuente)
          .sort((a, b) => a.iniciadoEn.localeCompare(b.iniciadoEn))[0] ?? null,
      ),
    saveObservation: (o) => {
      observaciones.set(o.id, { ...o });
      return Promise.resolve();
    },
    findObservationByOrigin: (owner, fuente, referencia) =>
      Promise.resolve(
        [...observaciones.values()].find(
          (o) => o.owner === owner && o.fuente === fuente && o.referencia === referencia,
        ) ?? null,
      ),
    findObservationsByFingerprint: (owner, huellas) =>
      Promise.resolve(
        [...observaciones.values()].filter((o) => o.owner === owner && huellas.includes(o.huella)),
      ),
    listObservations: (transactionId) =>
      Promise.resolve([...observaciones.values()].filter((o) => o.transactionId === transactionId)),
    deleteObservation: (id) => {
      observaciones.delete(id);
      return Promise.resolve();
    },
  };
}
