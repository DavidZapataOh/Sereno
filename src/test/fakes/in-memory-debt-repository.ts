import type { Debt } from '@/domain/debt/debt';
import type { DebtRepository } from '@/domain/debt/debt-repository';

export function createInMemoryDebtRepository(): DebtRepository {
  const deudas = new Map<string, Debt>();
  return {
    guardar: (deuda) => {
      deudas.set(deuda.accountId, { ...deuda });
      return Promise.resolve();
    },
    buscar: (id) => Promise.resolve(deudas.get(id) ?? null),
    listar: (owner) => Promise.resolve([...deudas.values()].filter((d) => d.owner === owner)),
    borrar: (id) => {
      deudas.delete(id);
      return Promise.resolve();
    },
  };
}
