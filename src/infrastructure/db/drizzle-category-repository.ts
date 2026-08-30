import { eq } from 'drizzle-orm';

import type { CategoryDetails, CategoryRepository } from '@/domain/categorization/category';
import type { CategoryGroup } from '@/domain/categorization/taxonomy';
import { accountId, ownerId } from '@/domain/ledger/ids';

import type { Database } from './database';
import { categories } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

const toDetails = (fila: typeof categories.$inferSelect): CategoryDetails => ({
  accountId: accountId(fila.accountId),
  owner: ownerId(fila.ownerId),
  grupo: fila.grupo as CategoryGroup,
  icono: fila.icono,
  orden: fila.orden,
});

export function createDrizzleCategoryRepository(db: Database): CategoryRepository {
  return {
    saveDetails: (d) =>
      asPromise(() => {
        db.insert(categories)
          .values({
            accountId: d.accountId,
            ownerId: d.owner,
            grupo: d.grupo,
            icono: d.icono,
            orden: d.orden,
          })
          .onConflictDoUpdate({
            target: categories.accountId,
            set: { grupo: d.grupo, icono: d.icono, orden: d.orden },
          })
          .run();
      }),

    findDetails: (id) =>
      asPromise(() => {
        const [fila] = db.select().from(categories).where(eq(categories.accountId, id)).all();
        return fila === undefined ? null : toDetails(fila);
      }),

    listDetails: (owner) =>
      asPromise(() =>
        db.select().from(categories).where(eq(categories.ownerId, owner)).all().map(toDetails),
      ),
  };
}
