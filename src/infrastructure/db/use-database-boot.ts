import { useEffect, useState } from 'react';

import { observability } from '../observability';

import { applyMigrations, openDatabase } from './client';
import type { Database } from './database';
import { estadoDeMigraciones } from './migration-state';

export type DatabaseBoot =
  { estado: 'cargando' } | { estado: 'listo'; db: Database } | { estado: 'error'; error: Error };

/**
 * Abre la base y aplica las migraciones al arrancar.
 *
 * La app no pinta nada que dependa de datos hasta que esto resuelve: una
 * pantalla que consulta una tabla que todavía no existe falla con un error que
 * no dice «las migraciones no han corrido», dice «no such table».
 *
 * Si falla, se devuelve el error en vez de lanzar: el arranque decide qué
 * mostrar, y quedarse en la pantalla de inicio no es una opción.
 */
export function useDatabaseBoot(): DatabaseBoot {
  const [boot, setBoot] = useState<DatabaseBoot>({ estado: 'cargando' });

  useEffect(() => {
    let vigente = true;
    const { db, sqlite } = openDatabase();

    // Antes de migrar, y siempre: si una migración se va a descartar en
    // silencio —marca fuera de orden—, esta es la única línea que lo dice.
    // Sin ella, el síntoma aparece semanas después como «no such table».
    const estado = estadoDeMigraciones(sqlite);
    observability.log(estado.descartadas.length > 0 ? 'warn' : 'info', 'migraciones', estado);

    applyMigrations(db)
      .then(() => {
        if (vigente) setBoot({ estado: 'listo', db });
      })
      .catch((error: unknown) => {
        if (vigente) {
          setBoot({
            estado: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

    return () => {
      vigente = false;
    };
  }, []);

  return boot;
}
