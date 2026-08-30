import type { Reconciliation } from '@/domain/reconciliation/reconciliation';
import type { ReconciliationRepository } from '@/domain/reconciliation/reconciliation-repository';

export interface InMemoryReconciliationRepository extends ReconciliationRepository {
  all: () => Reconciliation[];
}

export function createInMemoryReconciliationRepository(): InMemoryReconciliationRepository {
  const registros = new Map<string, Reconciliation>();
  const porCuenta = (cuenta: string) =>
    [...registros.values()]
      .filter((r) => r.accountId === cuenta)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    all: () => [...registros.values()],
    save: (r) => {
      registros.set(r.id, { ...r });
      return Promise.resolve();
    },
    findById: (id) => Promise.resolve(registros.get(id) ?? null),
    findLatest: (cuenta) => Promise.resolve(porCuenta(cuenta)[0] ?? null),
    listByAccount: (cuenta) => Promise.resolve(porCuenta(cuenta)),
  };
}
