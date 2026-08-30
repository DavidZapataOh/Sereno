import { toCategory, type Category } from '@/domain/categorization/category';
import {
  CATEGORY_GROUPS,
  categoryAccountId,
  DEFAULT_CATEGORIES,
  type CategoryGroup,
} from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import type { OwnerId } from '@/domain/ledger/ids';

import type { CategorizationDeps } from './types';

/**
 * Crea las categorías por defecto que falten. Idempotente: lo que ya existe
 * no se toca, así que un nombre cambiado por el usuario sobrevive a cada
 * arranque.
 */
export async function ensureDefaultCategories(
  deps: Pick<CategorizationDeps, 'accounts' | 'categories'>,
  owner: OwnerId,
): Promise<{ creadas: number }> {
  let creadas = 0;
  for (const spec of DEFAULT_CATEGORIES) {
    const id = categoryAccountId(spec.slug);
    if ((await deps.accounts.findById(id)) !== null) continue;
    await deps.accounts.save(
      createAccount({ id, owner, kind: spec.kind, nombre: spec.nombre, currency: 'COP' }),
    );
    await deps.categories.saveDetails({
      accountId: id,
      owner,
      grupo: spec.grupo,
      icono: spec.icono,
      orden: spec.orden,
    });
    creadas += 1;
  }
  return { creadas };
}

const posicion = (grupo: CategoryGroup): number => CATEGORY_GROUPS.indexOf(grupo);

/** Las categorías del usuario, enteras, por grupo y orden. */
export async function listCategories(
  deps: Pick<CategorizationDeps, 'accounts' | 'categories'>,
  owner: OwnerId,
  options: { incluirArchivadas?: boolean } = {},
): Promise<Category[]> {
  const detalles = await deps.categories.listDetails(owner);
  const cuentas = await deps.accounts.listByOwner(owner, { incluirArchivadas: true });
  const porId = new Map(cuentas.map((c) => [c.id, c]));
  const categorias: Category[] = [];
  for (const d of detalles) {
    const cuenta = porId.get(d.accountId);
    if (cuenta === undefined) continue;
    if (cuenta.archivedAt !== null && options.incluirArchivadas !== true) continue;
    categorias.push(toCategory(cuenta, d));
  }
  return categorias.sort((a, b) => {
    const porGrupo = posicion(a.grupo) - posicion(b.grupo);
    if (porGrupo !== 0) return porGrupo;
    const porOrden = a.orden - b.orden;
    if (porOrden !== 0) return porOrden;
    return a.nombre.localeCompare(b.nombre);
  });
}
