import type { BatchRepository, ClassificationBatch } from '@/domain/categorization/batch';

export interface InMemoryBatchRepository extends BatchRepository {
  all: () => ClassificationBatch[];
}

export function createInMemoryBatchRepository(): InMemoryBatchRepository {
  const lotes = new Map<string, ClassificationBatch>();
  return {
    all: () => [...lotes.values()],
    save: (b) => {
      lotes.set(b.id, { ...b, cambios: b.cambios.map((c) => ({ ...c })) });
      return Promise.resolve();
    },
    findById: (id) => Promise.resolve(lotes.get(id) ?? null),
    findLatest: (owner) =>
      Promise.resolve(
        [...lotes.values()]
          .filter((b) => b.owner === owner && b.deshechoEn === null)
          .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))[0] ?? null,
      ),
  };
}
