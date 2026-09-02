import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'node:path';

import type { Database } from './database';
import * as schema from './schema';

export type TestDb = {
  readonly db: Database;
  readonly close: () => void;
};

/**
 * Base en memoria para las pruebas.
 *
 * Aplica las migraciones **reales** de `drizzle/`, no un `CREATE TABLE` escrito
 * a mano: si las pruebas montan su propio esquema dejan de detectar el caso que
 * más duele, que es una migración que no corre en el dispositivo.
 */
export interface TestDbOptions {
  /**
   * Recibe cada sentencia que SQLite llega a ejecutar, con sus parámetros ya
   * sustituidos. Sirve para comprobar el plan de ejecución de las consultas
   * REALES del repositorio en vez de una copia escrita en la prueba, que es lo
   * que acaba desincronizándose.
   */
  onSql?: (sql: string) => void;
  /**
   * Cuántas filas devuelve cada consulta que lee.
   *
   * Mide el coste del diseño, no el de la máquina. El reloj dice que algo se
   * volvió diez veces más lento; esto dice **que una pantalla lee el historial
   * una vez por cuenta**, que con poco volumen no se nota en el reloj y con
   * cinco años es la diferencia entre abrir la app y esperarla.
   */
  onFilas?: (sql: string, filas: number) => void;
}

export function createTestDb(options: TestDbOptions = {}): TestDb {
  const { onSql, onFilas } = options;
  const sqlite = new SQLite(':memory:', {
    // `verbose` de better-sqlite3 llega tipado como `unknown`: recibe el texto
    // de la sentencia, pero su firma admite cualquier cosa.
    verbose:
      onSql === undefined
        ? undefined
        : (mensaje?: unknown) => {
            if (typeof mensaje === 'string') onSql(mensaje);
          },
  });

  // SQLite trae las claves foráneas DESACTIVADAS por defecto en cada conexión.
  // Sin esto los tests aceptarían apuntes huérfanos que el dispositivo también
  // aceptaría: la restricción existiría solo en el papel del esquema.
  sqlite.pragma('foreign_keys = ON');

  // Se envuelve `prepare` para contar las filas que SQLite llega a devolver.
  // No hay forma de saberlo desde Drizzle: `onSql` da el texto de la consulta,
  // no lo que costó.
  if (onFilas !== undefined) {
    const original = sqlite.prepare.bind(sqlite);
    // El tipo de `prepare` es genérico en los parámetros y en la fila; aquí solo
    // se envuelve `all`, así que se trabaja con la forma mínima.
    type Sentencia = { all: (...parametros: unknown[]) => unknown[] };
    sqlite.prepare = ((sql: string) => {
      const sentencia = original(sql) as unknown as Sentencia;
      const todas = sentencia.all.bind(sentencia);
      sentencia.all = (...parametros: unknown[]) => {
        const filas = todas(...parametros);
        onFilas(sql, filas.length);
        return filas;
      };
      return sentencia;
    }) as typeof sqlite.prepare;
  }

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '../../../drizzle') });

  return {
    db,
    close: () => {
      sqlite.close();
    },
  };
}
