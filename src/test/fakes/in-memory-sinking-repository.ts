import type { SinkingFund } from '@/domain/sinking/sinking-fund';
import type { SinkingRepository } from '@/domain/sinking/sinking-repository';

export function createInMemorySinkingRepository(): SinkingRepository {
  const fondos = new Map<string, SinkingFund>();
  return {
    guardar: (fondo) => {
      fondos.set(fondo.accountId, { ...fondo });
      return Promise.resolve();
    },
    buscar: (id) => Promise.resolve(fondos.get(id) ?? null),
    listar: (owner) => Promise.resolve([...fondos.values()].filter((f) => f.owner === owner)),
    borrar: (id) => {
      fondos.delete(id);
      return Promise.resolve();
    },
  };
}
