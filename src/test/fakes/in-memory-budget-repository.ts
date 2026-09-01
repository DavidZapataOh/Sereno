import type { BudgetRepository } from '@/domain/budget/budget-repository';
import type { Envelope } from '@/domain/budget/envelope';

export function createInMemoryBudgetRepository(): BudgetRepository {
  const sobres = new Map<string, Envelope>();
  const clave = (owner: string, mes: string, categoria: string) => `${owner}:${mes}:${categoria}`;

  return {
    guardar: (sobre) => {
      sobres.set(clave(sobre.owner, sobre.mes, sobre.categoria), { ...sobre });
      return Promise.resolve();
    },
    listar: (owner, mes) =>
      Promise.resolve([...sobres.values()].filter((s) => s.owner === owner && s.mes === mes)),
    borrar: (owner, mes, categoria) => {
      sobres.delete(clave(owner, mes, categoria));
      return Promise.resolve();
    },
  };
}
