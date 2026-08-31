import type { Snapshot } from '@/domain/overview/snapshot';
import type { SnapshotRepository } from '@/domain/overview/snapshot-repository';

export function createInMemorySnapshotRepository(): SnapshotRepository {
  const porDia = new Map<string, Snapshot>();
  return {
    guardar: (instantanea) => {
      // La clave es (propietario, día): dos del mismo día son un punto.
      porDia.set(`${instantanea.owner}:${instantanea.dia}`, { ...instantanea });
      return Promise.resolve();
    },
    serie: (owner, desde, hasta) =>
      Promise.resolve(
        [...porDia.values()]
          .filter((s) => s.owner === owner && s.dia >= desde && s.dia <= hasta)
          .sort((a, b) => a.dia.localeCompare(b.dia)),
      ),
  };
}
