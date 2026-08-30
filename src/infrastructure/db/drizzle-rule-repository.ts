import { eq } from 'drizzle-orm';

import type { Rule } from '@/domain/categorization/rule';
import type { RuleRepository } from '@/domain/categorization/rule-repository';
import { accountId, ownerId } from '@/domain/ledger/ids';

import type { Database } from './database';
import { rules } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

const toRule = (fila: typeof rules.$inferSelect): Rule => ({
  id: fila.id,
  owner: ownerId(fila.ownerId),
  campo: fila.campo,
  operador: fila.operador,
  valor: fila.valor,
  categoria: accountId(fila.categoria),
  creadaEn: fila.creadaEn,
  activa: fila.activa,
});

export function createDrizzleRuleRepository(db: Database): RuleRepository {
  return {
    save: (rule) =>
      asPromise(() => {
        const fila = {
          id: rule.id,
          ownerId: rule.owner,
          campo: rule.campo,
          operador: rule.operador,
          valor: rule.valor,
          categoria: rule.categoria,
          creadaEn: rule.creadaEn,
          activa: rule.activa,
        };
        db.insert(rules).values(fila).onConflictDoUpdate({ target: rules.id, set: fila }).run();
      }),
    findById: (id) =>
      asPromise(() => {
        const [fila] = db.select().from(rules).where(eq(rules.id, id)).all();
        return fila === undefined ? null : toRule(fila);
      }),
    listByOwner: (owner) =>
      asPromise(() => db.select().from(rules).where(eq(rules.ownerId, owner)).all().map(toRule)),
    delete: (id) =>
      asPromise(() => {
        db.delete(rules).where(eq(rules.id, id)).run();
      }),
  };
}
