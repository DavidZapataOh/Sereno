import { eq } from 'drizzle-orm';

import type { SyncStateRepository } from '@/domain/sync/server-client';

import type { Database } from './database';
import { estadoSync } from './schema';

const CURSOR = 'cursor';
const ULTIMA = 'ultimaTraida';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export function createDrizzleSyncStateRepository(db: Database): SyncStateRepository {
  const leer = (clave: string): string | null => {
    const [fila] = db.select().from(estadoSync).where(eq(estadoSync.clave, clave)).all();
    return fila?.valor ?? null;
  };
  const escribir = (clave: string, valor: string): void => {
    db.insert(estadoSync)
      .values({ clave, valor })
      .onConflictDoUpdate({ target: estadoSync.clave, set: { valor } })
      .run();
  };

  return {
    // Sin cursor guardado, el dispositivo empieza por el principio de la fila.
    leerCursor: () => asPromise(() => Number(leer(CURSOR) ?? 0)),
    escribirCursor: (valor) =>
      asPromise(() => {
        escribir(CURSOR, String(valor));
      }),
    ultimaTraida: () => asPromise(() => leer(ULTIMA)),
    marcarTraida: (iso) =>
      asPromise(() => {
        escribir(ULTIMA, iso);
      }),
  };
}
