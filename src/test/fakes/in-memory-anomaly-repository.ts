import type { AnomalyRepository } from '@/domain/anomalies/anomaly-repository';

export function createInMemoryAnomalyRepository(): AnomalyRepository {
  const descartadas = new Map<string, Set<string>>();
  return {
    descartar: (owner, id) => {
      descartadas.set(owner, (descartadas.get(owner) ?? new Set()).add(id));
      return Promise.resolve();
    },
    descartadas: (owner) => Promise.resolve(new Set(descartadas.get(owner) ?? [])),
  };
}
