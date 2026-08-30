import { createContext, useContext, type ReactNode } from 'react';

import type { Database } from './database';

const DatabaseContext = createContext<Database | null>(null);

/**
 * Pone la base abierta a disposición de las rutas.
 *
 * Solo las rutas la consumen: la interfaz recibe funciones ya cableadas por
 * props y no sabe que existe una base. Es la misma regla que con el reporte de
 * errores y el script inyectado.
 */
export function DatabaseProvider({ db, children }: { db: Database; children: ReactNode }) {
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): Database {
  const db = useContext(DatabaseContext);
  if (db === null) throw new Error('useDatabase debe usarse dentro de un DatabaseProvider');
  return db;
}
