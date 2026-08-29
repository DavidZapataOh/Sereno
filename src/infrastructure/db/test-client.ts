import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'node:path';

import * as schema from './schema';

export type TestDb = {
  readonly db: ReturnType<typeof drizzle<typeof schema>>;
  readonly close: () => void;
};

/**
 * Base en memoria para las pruebas.
 *
 * Aplica las migraciones **reales** de `drizzle/`, no un `CREATE TABLE` escrito
 * a mano: si las pruebas montan su propio esquema dejan de detectar el caso que
 * más duele, que es una migración que no corre en el dispositivo.
 */
export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');

  // SQLite trae las claves foráneas DESACTIVADAS por defecto en cada conexión.
  // Sin esto los tests aceptarían apuntes huérfanos que el dispositivo también
  // aceptaría: la restricción existiría solo en el papel del esquema.
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '../../../drizzle') });

  return {
    db,
    close: () => {
      sqlite.close();
    },
  };
}
