import SQLite from 'better-sqlite3';
import type { SQLiteDatabase } from 'expo-sqlite';

import migraciones from '../../../drizzle/migrations';

import { estadoDeMigraciones } from './migration-state';

/**
 * `estadoDeMigraciones` solo necesita `getAllSync`. Un doble mínimo sobre
 * SQLite de verdad prueba las dos cosas que importan: la consulta al registro
 * y el caso de la tabla que todavía no existe.
 */
function comoExpo(sqlite: SQLite.Database): SQLiteDatabase {
  return {
    getAllSync: <T>(consulta: string) => sqlite.prepare(consulta).all() as T[],
  } as unknown as SQLiteDatabase;
}

function baseCon(marcas: number[]): SQLiteDatabase {
  const sqlite = new SQLite(':memory:');
  sqlite.exec(
    'CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT, created_at NUMERIC)',
  );
  for (const m of marcas) {
    sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run('h', m);
  }
  return comoExpo(sqlite);
}

describe('estadoDeMigraciones', () => {
  it('en una base nueva, todas están por aplicar', () => {
    const sqlite = new SQLite(':memory:');
    const estado = estadoDeMigraciones(comoExpo(sqlite));

    expect(estado.aplicadas).toBe(0);
    expect(estado.ultimaMarca).toBeNull();
    expect(estado.porAplicar).toHaveLength(estado.enJournal);
    expect(estado.descartadas).toEqual([]);
  });

  it('con todo aplicado, no queda nada por hacer', () => {
    const todas = estadoDeMigraciones(baseCon([]));
    // Se simula una base al día usando las marcas reales del journal.
    const sqlite = new SQLite(':memory:');
    sqlite.exec(
      'CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT, created_at NUMERIC)',
    );
    const marcas = marcasDelJournal();
    for (const m of marcas) {
      sqlite
        .prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)')
        .run('h', m);
    }

    const estado = estadoDeMigraciones(comoExpo(sqlite));

    expect(estado.aplicadas).toBe(todas.enJournal);
    expect(estado.porAplicar).toEqual([]);
    expect(estado.descartadas).toEqual([]);
  });

  /**
   * El fallo del 2026-08-31: una migración con la marca por debajo de la
   * última aplicada no entra nunca, y el migrador no dice nada. Esta es la
   * lista que lo hace visible.
   */
  it('señala la que quedaría descartada para siempre', () => {
    const marcas = marcasDelJournal();
    // Se simula que se aplicaron todas menos la penúltima, y que la última ya
    // pasó: la penúltima queda por debajo del corte y nunca entrará.
    const sinLaPenultima = marcas.filter((m) => m !== marcas[marcas.length - 2]);

    const estado = estadoDeMigraciones(baseCon(sinLaPenultima));

    expect(estado.descartadas).toHaveLength(1);
    expect(estado.porAplicar).toEqual([]);
  });

  it('no confunde «pendiente» con «descartada»', () => {
    const marcas = marcasDelJournal();
    const estado = estadoDeMigraciones(baseCon(marcas.slice(0, -1)));

    expect(estado.porAplicar).toHaveLength(1);
    expect(estado.descartadas).toEqual([]);
  });
});

function marcasDelJournal(): number[] {
  return migraciones.journal.entries.map((e) => e.when);
}
