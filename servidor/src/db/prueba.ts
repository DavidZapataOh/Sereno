import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import * as schema from './schema';

/**
 * Una base para pruebas: Postgres de verdad, compilado a WebAssembly, en
 * memoria. Aplica las migraciones reales —las mismas que corren en el
 * servidor—, así que una migración rota se ve aquí y no en producción.
 */
export async function crearBaseDePrueba() {
  const cliente = new PGlite();
  const db = drizzle(cliente, { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) });
  return { db, cerrar: () => cliente.close() };
}
