import { randomUUID } from 'expo-crypto';

import type { IdGenerator } from '@/domain/ledger/ids';

/** UUID v4 del sistema. Funciona en Expo Go. */
export function createCryptoIdGenerator(): IdGenerator {
  return { next: () => randomUUID() };
}
