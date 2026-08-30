import type { Reconciliation } from '@/domain/reconciliation/reconciliation';
import type { ReconciliationRepository } from '@/domain/reconciliation/reconciliation-repository';

export interface InMemoryReconciliationRepository extends ReconciliationRepository {
  all: () => Reconciliation[];
}

export function createInMemoryReconciliationRepository(): InMemoryReconciliationRepository {
  const registros = new Map<string, Reconciliation>();
  // Misma fecha (la captura y el ajuste que la cierra): gana la registrada de
  // último, igual que en SQLite.
  const porCuenta = (cuenta: string) =>
    [...registros.values()]
      .map((r, orden) => ({ r, orden }))
      .filter(({ r }) => r.accountId === cuenta)
      .sort((a, b) => {
        const porFecha = b.r.fecha.localeCompare(a.r.fecha);
        if (porFecha !== 0) return porFecha;
        const porCreacion = b.r.creadoEn.localeCompare(a.r.creadoEn);
        if (porCreacion !== 0) return porCreacion;
        return b.orden - a.orden;
      })
      .map(({ r }) => r);
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
