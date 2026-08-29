import migraciones from '../../../drizzle/migrations';

import { abrirBaseDeDatos, aplicarMigraciones, NOMBRE_BASE_DE_DATOS } from './client';

const mockExecSync = jest.fn();
const mockOpenDatabaseSync = jest.fn((_nombre: string, _opciones?: Record<string, unknown>) => ({
  execSync: mockExecSync,
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (nombre: string, opciones?: Record<string, unknown>) =>
    mockOpenDatabaseSync(nombre, opciones),
}));

const mockMigrate = jest.fn();

jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => ({ marca: 'db' })),
}));

jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  migrate: (db: unknown, config: unknown): Promise<void> => {
    mockMigrate(db, config);
    return Promise.resolve();
  },
}));

describe('cliente del dispositivo', () => {
  it('abre la base con el nombre esperado', () => {
    abrirBaseDeDatos();

    expect(mockOpenDatabaseSync).toHaveBeenCalledWith(NOMBRE_BASE_DE_DATOS, {
      enableChangeListener: true,
    });
  });

  /**
   * `useLiveQuery` se suscribe a `addDatabaseChangeListener`, y ese listener
   * solo emite si la base se abrió con `enableChangeListener`. Sin la opción, la
   * interfaz se quedaría con datos viejos sin lanzar ningún error.
   */
  it('habilita el listener de cambios que necesita useLiveQuery', () => {
    abrirBaseDeDatos();

    const opciones = mockOpenDatabaseSync.mock.calls[0]?.[1];
    expect(opciones).toEqual({ enableChangeListener: true });
  });

  /**
   * Esta prueba existe por una diferencia entre motores, no por gusto:
   * `better-sqlite3` activa las claves foráneas solo; el SQLite del dispositivo
   * no. Sin esta comprobación, borrar el PRAGMA de `client.ts` dejaría la suite
   * entera en verde y la integridad referencial solo existiría en el papel.
   */
  it('activa las claves foráneas, que en el dispositivo vienen apagadas', () => {
    abrirBaseDeDatos();

    expect(mockExecSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
  });

  it('activa WAL para que leer no se bloquee contra la sincronización', () => {
    abrirBaseDeDatos();

    expect(mockExecSync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
  });

  it('fija los PRAGMA antes de que las migraciones abran una transacción', () => {
    abrirBaseDeDatos();

    // El PRAGMA es un no-op dentro de una transacción: si se ejecutara después
    // de migrar, SQLite lo aceptaría sin protestar y no haría nada.
    const orden = mockExecSync.mock.invocationCallOrder;
    const apertura = mockOpenDatabaseSync.mock.invocationCallOrder[0] ?? 0;

    expect(orden.every((momento) => momento > apertura)).toBe(true);
    expect(mockExecSync).toHaveBeenCalledTimes(2);
  });

  /**
   * Guarda del `babel.config.js`: sin el plugin `inline-import`, los `.sql` no
   * se incrustan y `migrations` llega con cadenas vacías. Metro no avisa —
   * simplemente no crearía ninguna tabla en el dispositivo.
   */
  it('incrusta el SQL de las migraciones, no solo su nombre', () => {
    const sqls = Object.values(migraciones.migrations);

    expect(sqls.length).toBeGreaterThan(0);
    expect(sqls[0]).toContain('CREATE TABLE `accounts`');
    expect(migraciones.journal.entries).toHaveLength(sqls.length);
  });

  it('aplica las migraciones incrustadas sobre la base abierta', async () => {
    const { db } = abrirBaseDeDatos();

    await aplicarMigraciones(db);

    expect(mockMigrate).toHaveBeenCalledWith(db, migraciones);
  });
});
