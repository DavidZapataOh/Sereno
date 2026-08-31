import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as schema from './schema';

const CARPETA = join(__dirname, '..', '..', '..', 'drizzle');

interface Entrada {
  idx: number;
  when: number;
  tag: string;
}

const journal = (): { entries: Entrada[] } =>
  JSON.parse(readFileSync(join(CARPETA, 'meta', '_journal.json'), 'utf8')) as {
    entries: Entrada[];
  };

function baseNueva() {
  const sqlite = new SQLite(':memory:');
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

/** Nombres de tabla e índice: la forma del esquema, sin depender del orden. */
function formaDe(sqlite: SQLite.Database): string[] {
  return sqlite
    .prepare(
      `SELECT type || ' ' || name AS f FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY f`,
    )
    .all()
    .map((fila) => (fila as { f: string }).f);
}

const temporales: string[] = [];

/** Una copia de `drizzle/` con el journal recortado a las primeras `n` migraciones. */
function carpetaHasta(n: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'migraciones-'));
  temporales.push(dir);
  cpSync(CARPETA, dir, { recursive: true });
  const j = journal();
  writeFileSync(
    join(dir, 'meta', '_journal.json'),
    JSON.stringify({ ...j, entries: j.entries.slice(0, n) }, null, 2),
  );
  return dir;
}

describe('migraciones sobre una base que ya migró', () => {
  afterAll(() => {
    for (const d of temporales) rmSync(d, { recursive: true, force: true });
  });

  /**
   * El caso que ninguna prueba veía y que rompió el teléfono de David el
   * 2026-08-31.
   *
   * `migrate` lee la última migración aplicada **una sola vez, antes del
   * bucle**, y luego solo aplica las que tengan una marca de tiempo mayor:
   *
   *     if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis)
   *
   * En una base vacía `lastDbMigration` es `undefined` y se aplican todas, en
   * orden, sin mirar las marcas. Por eso las pruebas pasaban. En una base que
   * ya migró, una marca fuera de orden hace que su migración **se salte en
   * silencio**: ni error, ni aviso, y la tabla que crea no existe.
   */
  it('aplicar de una en una deja el mismo esquema que aplicarlas todas de golpe', () => {
    const completa = baseNueva();
    migrate(completa.db, { migrationsFolder: CARPETA });
    const esperada = formaDe(completa.sqlite);
    completa.sqlite.close();

    // Ahora por pasos: primero hasta la penúltima, después el resto. Es lo que
    // pasa en un teléfono que ya venía usando la app.
    const total = journal().entries.length;
    const porPasos = baseNueva();
    migrate(porPasos.db, { migrationsFolder: carpetaHasta(total - 1) });
    migrate(porPasos.db, { migrationsFolder: CARPETA });
    const obtenida = formaDe(porPasos.sqlite);
    porPasos.sqlite.close();

    expect(obtenida).toEqual(esperada);
  });

  it('cada migración, aplicada una a una desde cero, llega al mismo esquema', () => {
    const completa = baseNueva();
    migrate(completa.db, { migrationsFolder: CARPETA });
    const esperada = formaDe(completa.sqlite);
    completa.sqlite.close();

    const total = journal().entries.length;
    const paso = baseNueva();
    for (let n = 1; n <= total; n += 1) {
      migrate(paso.db, { migrationsFolder: carpetaHasta(n) });
    }
    const obtenida = formaDe(paso.sqlite);
    paso.sqlite.close();

    expect(obtenida).toEqual(esperada);
  });

  /**
   * La comprobación barata que hace innecesario depurar lo de arriba: si las
   * marcas van en orden, ninguna migración se puede saltar.
   */
  it('las marcas de tiempo del journal son estrictamente crecientes', () => {
    const marcas = journal().entries.map((e) => e.when);

    expect(marcas).toEqual([...marcas].sort((a, b) => a - b));
    expect(new Set(marcas).size).toBe(marcas.length);
  });

  it('los índices del journal van de cero en adelante, sin huecos', () => {
    expect(journal().entries.map((e) => e.idx)).toEqual(journal().entries.map((_, i) => i));
  });

  it('todas las migraciones aplicadas se registran', () => {
    const { sqlite, db } = baseNueva();
    migrate(db, { migrationsFolder: CARPETA });

    const aplicadas = sqlite.prepare(`SELECT COUNT(*) AS n FROM __drizzle_migrations`).get() as {
      n: number;
    };
    sqlite.close();

    expect(aplicadas.n).toBe(journal().entries.length);
  });
});
