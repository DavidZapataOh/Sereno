import type { CategoryDetails, CategoryRepository } from '@/domain/categorization/category';

export interface InMemoryCategoryRepository extends CategoryRepository {
  all: () => CategoryDetails[];
}

export function createInMemoryCategoryRepository(): InMemoryCategoryRepository {
  const detalles = new Map<string, CategoryDetails>();
  return {
    all: () => [...detalles.values()],
    saveDetails: (d) => {
      detalles.set(d.accountId, { ...d });
      return Promise.resolve();
    },
    findDetails: (id) => Promise.resolve(detalles.get(id) ?? null),
    listDetails: (owner) =>
      Promise.resolve([...detalles.values()].filter((d) => d.owner === owner)),
  };
}
