import type { Account } from '@/domain/ledger/account';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';

import type { CategoryGroup } from './taxonomy';

/** Lo que una cuenta no tiene y una categoría sí. Clave: la cuenta. */
export interface CategoryDetails {
  accountId: AccountId;
  owner: OwnerId;
  grupo: CategoryGroup;
  icono: string;
  orden: number;
}

/** Una categoría vista entera: la cuenta más su detalle. */
export interface Category {
  id: AccountId;
  owner: OwnerId;
  kind: 'gasto' | 'ingreso';
  nombre: string;
  grupo: CategoryGroup;
  icono: string;
  orden: number;
  archivedAt: string | null;
}

export interface CategoryRepository {
  saveDetails: (details: CategoryDetails) => Promise<void>;
  findDetails: (id: AccountId) => Promise<CategoryDetails | null>;
  listDetails: (owner: OwnerId) => Promise<CategoryDetails[]>;
}

export function toCategory(account: Account, details: CategoryDetails): Category {
  if (account.kind !== 'gasto' && account.kind !== 'ingreso') {
    throw new Error(
      `La cuenta "${account.id}" no es de gasto ni de ingreso: no puede ser categoría`,
    );
  }
  return {
    id: account.id,
    owner: account.owner,
    kind: account.kind,
    nombre: account.nombre,
    grupo: details.grupo,
    icono: details.icono,
    orden: details.orden,
    archivedAt: account.archivedAt,
  };
}
