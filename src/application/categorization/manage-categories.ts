import { toCategory, type Category } from '@/domain/categorization/category';
import { categoryAccountId, slugify, type CategoryGroup } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';

import type { CategorizationDeps } from './types';

type Deps = Pick<CategorizationDeps, 'accounts' | 'categories' | 'clock'>;

async function cuentaDe(deps: Deps, owner: OwnerId, id: AccountId) {
  const cuenta = await deps.accounts.findById(id);
  if (cuenta === null || cuenta.owner !== owner) {
    throw new Error(`No existe la categoría "${id}"`);
  }
  return cuenta;
}

export async function createCategory(
  deps: Deps,
  input: {
    owner: OwnerId;
    nombre: string;
    kind: 'gasto' | 'ingreso';
    grupo: CategoryGroup;
    icono: string;
  },
): Promise<Category> {
  const id = categoryAccountId(slugify(input.nombre));
  if ((await deps.accounts.findById(id)) !== null) {
    throw new Error(`Ya existe una categoría que se llama «${input.nombre.trim()}»`);
  }
  const cuenta = createAccount({
    id,
    owner: input.owner,
    kind: input.kind,
    nombre: input.nombre,
    currency: 'COP',
  });
  const existentes = await deps.categories.listDetails(input.owner);
  const ordenes = existentes.filter((d) => d.grupo === input.grupo).map((d) => d.orden);
  const detalle = {
    accountId: id,
    owner: input.owner,
    grupo: input.grupo,
    icono: input.icono,
    orden: Math.max(0, ...ordenes) + 1,
  };
  await deps.accounts.save(cuenta);
  await deps.categories.saveDetails(detalle);
  return toCategory(cuenta, detalle);
}

export async function renameCategory(
  deps: Deps,
  input: { owner: OwnerId; id: AccountId; nombre: string },
): Promise<void> {
  const cuenta = await cuentaDe(deps, input.owner, input.id);
  const nombre = input.nombre.trim();
  if (nombre.length === 0) throw new Error('La categoría necesita un nombre');
  await deps.accounts.save({ ...cuenta, nombre });
}

/** Deja de ofrecerse; lo ya clasificado se queda donde está. */
export async function archiveCategory(
  deps: Deps,
  input: { owner: OwnerId; id: AccountId },
): Promise<void> {
  await cuentaDe(deps, input.owner, input.id);
  await deps.accounts.archive(input.id, deps.clock());
}
