import type { AccountId, OwnerId } from '@/domain/ledger/ids';

import type { SinkingFund } from './sinking-fund';

/**
 * Dónde viven los fondos.
 *
 * **Sin lo apartado.** Eso sale del ledger, como todo saldo: guardarlo daría dos
 * verdades sobre el mismo fondo y la guardada acabaría siendo la vieja.
 */
export interface SinkingRepository {
  guardar: (fondo: SinkingFund) => Promise<void>;
  buscar: (accountId: AccountId) => Promise<SinkingFund | null>;
  listar: (owner: OwnerId) => Promise<SinkingFund[]>;
  borrar: (accountId: AccountId) => Promise<void>;
}
