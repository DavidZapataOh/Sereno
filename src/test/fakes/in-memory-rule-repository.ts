import type { Rule } from '@/domain/categorization/rule';
import type { RuleRepository } from '@/domain/categorization/rule-repository';

export interface InMemoryRuleRepository extends RuleRepository {
  all: () => Rule[];
}

export function createInMemoryRuleRepository(): InMemoryRuleRepository {
  const reglas = new Map<string, Rule>();
  return {
    all: () => [...reglas.values()],
    save: (rule) => {
      reglas.set(rule.id, { ...rule });
      return Promise.resolve();
    },
    findById: (id) => Promise.resolve(reglas.get(id) ?? null),
    listByOwner: (owner) => Promise.resolve([...reglas.values()].filter((r) => r.owner === owner)),
    delete: (id) => {
      reglas.delete(id);
      return Promise.resolve();
    },
  };
}
