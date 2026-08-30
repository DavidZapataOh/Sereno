import type {
  Classification,
  ClassificationRepository,
} from '@/domain/categorization/classification';

export interface InMemoryClassificationRepository extends ClassificationRepository {
  all: () => Classification[];
}

export function createInMemoryClassificationRepository(): InMemoryClassificationRepository {
  const registros = new Map<string, Classification>();
  return {
    all: () => [...registros.values()],
    save: (c) => {
      registros.set(c.transactionId, { ...c });
      return Promise.resolve();
    },
    findByTransaction: (id) => Promise.resolve(registros.get(id) ?? null),
    listByOwner: (owner, filter) =>
      Promise.resolve(
        [...registros.values()].filter(
          (c) => c.owner === owner && (filter?.origen === undefined || c.origen === filter.origen),
        ),
      ),
    delete: (id) => {
      registros.delete(id);
      return Promise.resolve();
    },
  };
}
