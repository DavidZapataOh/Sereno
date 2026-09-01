import type { OwnerId } from '@/domain/ledger/ids';

import type { Envelope } from './envelope';

/**
 * Dónde viven las asignaciones.
 *
 * **Solo las asignaciones.** Lo gastado sale del ledger: guardarlo daría dos
 * verdades sobre el mismo mes, y la guardada acabaría siendo la vieja.
 */
export interface BudgetRepository {
  guardar: (sobre: Envelope) => Promise<void>;
  listar: (owner: OwnerId, mes: string) => Promise<Envelope[]>;
  borrar: (owner: OwnerId, mes: string, categoria: string) => Promise<void>;
}
