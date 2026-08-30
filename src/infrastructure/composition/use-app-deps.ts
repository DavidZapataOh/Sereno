import { useMemo } from 'react';

import type { AppDeps } from '@/application/sync/sync-portal';

import { useDatabase } from '../db/database-provider';
import { createRepositories } from '../db/repositories';
import { createCryptoIdGenerator } from '../ids/crypto-id-generator';

/**
 * Los puertos del sprint, cableados sobre la base abierta al arrancar.
 *
 * Es el único punto donde las rutas tocan infraestructura: reciben esto y
 * se lo pasan a los casos de uso. Memorizado por base: se construye una vez.
 */
export function useAppDeps(): AppDeps {
  const db = useDatabase();
  return useMemo(
    () => ({
      ...createRepositories(db),
      ids: createCryptoIdGenerator(),
      clock: () => new Date().toISOString(),
    }),
    [db],
  );
}
