import type { AccountId, OwnerId } from '@/domain/ledger/ids';

import type { Evidence } from './naive-bayes';

export interface EvidenceRepository {
  /** Suma (o resta, sin bajar de cero) uno a cada rasgo en la categoría. */
  add: (
    owner: OwnerId,
    features: readonly string[],
    categoria: AccountId,
    delta: 1 | -1,
  ) => Promise<void>;
  listByFeatures: (owner: OwnerId, features: readonly string[]) => Promise<Evidence[]>;
  /** Suma de conteos por categoría: el prior y el denominador de cada categoría. */
  countByCategory: (owner: OwnerId) => Promise<Map<AccountId, number>>;
  /** Rasgos distintos con evidencia: la V del suavizado. */
  vocabularySize: (owner: OwnerId) => Promise<number>;
}
