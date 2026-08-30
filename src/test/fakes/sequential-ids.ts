import type { IdGenerator } from '@/domain/ledger/ids';

export function createSequentialIds(prefix = 'id'): IdGenerator {
  let contador = 0;
  return {
    next: () => {
      contador += 1;
      return `${prefix}-${String(contador)}`;
    },
  };
}
