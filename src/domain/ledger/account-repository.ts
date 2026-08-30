import type { Money } from '@/domain/money/money';

import type { Account } from './account';
import type { AccountId, OwnerId } from './ids';

export interface BalanceOptions {
  /** Solo apuntes de transacciones con `fecha <= hasta`. Sin esto, el saldo actual. */
  hasta?: string;
}

export interface ListByOwnerOptions {
  incluirArchivadas?: boolean;
}

/**
 * Puerto de acceso a cuentas.
 *
 * El dominio declara qué necesita; la infraestructura decide cómo. Los casos de
 * uso dependen de esta interfaz y no de Drizzle, así que se prueban con una
 * implementación en memoria y sobreviven a un cambio de base de datos.
 */
export interface AccountRepository {
  save: (account: Account) => Promise<void>;
  findById: (id: AccountId) => Promise<Account | null>;
  listByOwner: (owner: OwnerId, options?: ListByOwnerOptions) => Promise<Account[]>;
  /**
   * Saldo derivado de los apuntes, nunca guardado suelto.
   *
   * Un saldo persistido es un dato que puede contradecir a los apuntes que lo
   * produjeron, y cuando eso ocurre no hay forma de saber cuál de los dos miente.
   */
  balanceOf: (id: AccountId, options?: BalanceOptions) => Promise<Money>;
  archive: (id: AccountId, fecha: string) => Promise<void>;
}
