import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import migraciones from '../../../drizzle/migrations';

import * as schema from './schema';

export const NOMBRE_BASE_DE_DATOS = 'sereno.db';

export type BaseDeDatos = ReturnType<typeof drizzle<typeof schema>>;

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
 *    una. Tiene que ejecutarse antes de `aplicarMigraciones`.
 */
export function abrirBaseDeDatos(): {
  readonly db: BaseDeDatos;
  readonly sqlite: SQLiteDatabase;
} {
  const sqlite = openDatabaseSync(NOMBRE_BASE_DE_DATOS);

  sqlite.execSync('PRAGMA foreign_keys = ON');
  // WAL deja que la interfaz lea mientras la sincronización escribe, en vez de
  // bloquearse contra ella.
  sqlite.execSync('PRAGMA journal_mode = WAL');

  return { db: drizzle(sqlite, { schema }), sqlite };
}

export async function aplicarMigraciones(db: BaseDeDatos): Promise<void> {
  await migrate(db, migraciones);
}
