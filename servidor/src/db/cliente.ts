import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

/** La base de producción. La cadena viene de la configuración (plan 05). */
export function crearBase(url: string) {
  return drizzle(postgres(url, { max: 4 }), { schema });
}

export type BasePostgres = ReturnType<typeof crearBase>;
