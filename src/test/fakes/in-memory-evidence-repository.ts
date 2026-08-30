import type { EvidenceRepository } from '@/domain/categorization/evidence-repository';
import type { Evidence } from '@/domain/categorization/naive-bayes';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';

export interface InMemoryEvidenceRepository extends EvidenceRepository {
  all: () => Evidence[];
}

export function createInMemoryEvidenceRepository(): InMemoryEvidenceRepository {
  const conteos = new Map<string, { owner: OwnerId; evidence: Evidence }>();
  const clave = (owner: OwnerId, feature: string, categoria: AccountId) =>
    `${owner}|${feature}|${categoria}`;
  return {
    all: () => [...conteos.values()].map((c) => c.evidence),
    add: (owner, features, categoria, delta) => {
      for (const feature of features) {
        const k = clave(owner, feature, categoria);
        const actual = conteos.get(k)?.evidence.cuenta ?? 0;
        conteos.set(k, {
          owner,
          evidence: { feature, categoria, cuenta: Math.max(0, actual + delta) },
        });
      }
      return Promise.resolve();
    },
    listByFeatures: (owner, features) => {
      const pedidos = new Set(features);
      return Promise.resolve(
        [...conteos.values()]
          .filter(
            (c) => c.owner === owner && pedidos.has(c.evidence.feature) && c.evidence.cuenta > 0,
          )
          .map((c) => c.evidence),
      );
    },
    countByCategory: (owner) => {
      const total = new Map<AccountId, number>();
      for (const c of conteos.values()) {
        if (c.owner !== owner) continue;
        total.set(c.evidence.categoria, (total.get(c.evidence.categoria) ?? 0) + c.evidence.cuenta);
      }
      return Promise.resolve(total);
    },
    vocabularySize: (owner) =>
      Promise.resolve(
        new Set(
          [...conteos.values()]
            .filter((c) => c.owner === owner && c.evidence.cuenta > 0)
            .map((c) => c.evidence.feature),
        ).size,
      ),
  };
}
