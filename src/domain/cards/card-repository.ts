import type { AccountId, OwnerId } from '@/domain/ledger/ids';

import type { CreditCard } from './card';

/**
 * Puerto de configuración de tarjetas.
 *
 * Solo guarda lo que el ledger no sabe: cupo, corte y pago. La deuda se
 * consulta al repositorio de cuentas, como la de cualquier otra cuenta.
 */
export interface CardRepository {
  save: (card: CreditCard) => Promise<void>;
  find: (accountId: AccountId) => Promise<CreditCard | null>;
  listByOwner: (owner: OwnerId) => Promise<CreditCard[]>;
}
