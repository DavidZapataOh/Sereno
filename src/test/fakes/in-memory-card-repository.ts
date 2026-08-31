import type { CardRepository } from '@/domain/cards/card-repository';
import type { CreditCard } from '@/domain/cards/card';
import type { AccountId } from '@/domain/ledger/ids';

export function createInMemoryCardRepository(): CardRepository {
  const tarjetas = new Map<AccountId, CreditCard>();
  return {
    save: (card) => {
      tarjetas.set(card.accountId, { ...card });
      return Promise.resolve();
    },
    find: (id) => Promise.resolve(tarjetas.get(id) ?? null),
    listByOwner: (owner) =>
      Promise.resolve([...tarjetas.values()].filter((t) => t.owner === owner)),
  };
}
