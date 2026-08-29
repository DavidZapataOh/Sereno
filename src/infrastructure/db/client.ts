import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import migraciones from '../../../drizzle/migrations';

import * as schema from './schema';

export const DATABASE_NAME = 'sereno.db';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Abre la base del dispositivo.
 *
 * OJO con el orden y con el PRAGMA:
 *
 * 1. SQLite trae `foreign_keys` DESACTIVADO por defecto, y la opción es *por
 *    conexión*, no por base. `better-sqlite3` —el motor de las pruebas— lo
 *    activa por su cuenta, así que las pruebas en memoria NO detectan que falte
 *    aquí: estarían en verde mientras el dispositivo acepta apuntes huérfanos.
 *    Por eso hay una prueba dedicada que verifica esta llamada.
 * 2. El PRAGMA se ignora dentro de una transacción, y las migraciones corren en
 *    una. Tiene que ejecutarse antes de `applyMigrations`.
 */
export function openDatabase(): {
  readonly db: Database;
  readonly sqlite: SQLiteDatabase;
} {
  // `enableChangeListener` es obligatorio para `useLiveQuery`: esa utilidad se
  // suscribe a `addDatabaseChangeListener`, que solo emite si la base se abrió
  // con esta opción. Sin ella la interfaz nunca se refrescaría, y sin error.
  const sqlite = openDatabaseSync(DATABASE_NAME, {
    enableChangeListener: true,
  });

  sqlite.execSync('PRAGMA foreign_keys = ON');
  // WAL deja que la interfaz lea mientras la sincronización escribe, en vez de
  // bloquearse contra ella.
  sqlite.execSync('PRAGMA journal_mode = WAL');

  return { db: drizzle(sqlite, { schema }), sqlite };
}

export async function applyMigrations(db: Database): Promise<void> {
  await migrate(db, migraciones);
}
