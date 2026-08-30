import type { TransferRecord } from '@/domain/ingest/transfer-record';
import type { TransferRepository } from '@/domain/ingest/transfer-repository';
import { pairKey } from '@/domain/ingest/transfers';

export interface InMemoryTransferRepository extends TransferRepository {
  all: () => TransferRecord[];
}

export function createInMemoryTransferRepository(): InMemoryTransferRepository {
  const registros = new Map<string, TransferRecord>();
  return {
    all: () => [...registros.values()],
    save: (r) => {
      registros.set(r.id, { ...r });
      return Promise.resolve();
    },
    findById: (id) => Promise.resolve(registros.get(id) ?? null),
    findByTransaction: (id) =>
      Promise.resolve([...registros.values()].find((r) => r.transactionId === id) ?? null),
    listByOwner: (owner, estado) =>
      Promise.resolve(
        [...registros.values()].filter(
          (r) => r.owner === owner && (estado === undefined || r.estado === estado),
        ),
      ),
    undoneKeys: (owner) =>
      Promise.resolve(
        new Set(
          [...registros.values()]
            .filter((r) => r.owner === owner && r.estado === 'deshecha')
            .map((r) => pairKey(r.salida.id, r.entrada.id)),
        ),
      ),
  };
}
