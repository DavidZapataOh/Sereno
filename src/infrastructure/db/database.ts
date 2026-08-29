import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Tipo común a los dos clientes.
 *
 * El del dispositivo va sobre `expo-sqlite` y el de las pruebas sobre
 * `better-sqlite3`. Se diferencian solo en el resultado de las escrituras, que
 * aquí no se usa, así que ambos encajan con `unknown` en esa posición. Gracias a
 * eso los repositorios reciben la base por parámetro y no necesitan saber cuál
 * de las dos les tocó.
 */
export type Database = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
