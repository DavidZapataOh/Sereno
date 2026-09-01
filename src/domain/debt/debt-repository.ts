import type { AccountId, OwnerId } from '@/domain/ledger/ids';

import type { Debt } from './debt';

/**
 * Dónde viven los **términos** de una deuda.
 *
 * No el saldo: ese sale del ledger. Si algún día aparece aquí un método que
 * devuelva cuánto se debe, algo se entendió mal.
 */
export interface DebtRepository {
  guardar: (deuda: Debt) => Promise<void>;
  buscar: (accountId: AccountId) => Promise<Debt | null>;
  listar: (owner: OwnerId) => Promise<Debt[]>;
  borrar: (accountId: AccountId) => Promise<void>;
}
