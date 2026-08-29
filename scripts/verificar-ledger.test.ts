import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

/**
 * El diagnóstico, ejecutado de verdad.
 *
 * Se lanza como proceso en vez de llamar a `checkLedger` directamente porque lo
 * que aquí puede romperse no es la lógica —que ya tiene sus pruebas— sino el
 * cableado: la resolución del alias `@/`, el intérprete, el código de salida.
 * Nada de eso se ve importando la función.
 */
describe('scripts/verificar-ledger', () => {
  jest.setTimeout(60_000);

  let carpeta: string;

  const crearBase = (corromper: boolean): string => {
    const ruta = join(carpeta, corromper ? 'rota.db' : 'sana.db');
    const sqlite = new SQLite(ruta);
    sqlite.pragma('foreign_keys = ON');
    migrate(drizzle(sqlite), { migrationsFolder: join(__dirname, '../drizzle') });

    sqlite
      .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?)')
      .run('banco', 'david', 'activo', 'Banco', 'COP', null);
    sqlite
      .prepare('INSERT INTO accounts VALUES (?,?,?,?,?,?)')
      .run('gasto', 'david', 'gasto', 'Gasto', 'COP', null);
    sqlite
      .prepare('INSERT INTO transactions VALUES (?,?,?,?,?,?)')
      .run('t1', 'david', '2026-08-20T00:00:00.000Z', 'Compra', 'prueba', 'r1');
    sqlite
      .prepare('INSERT INTO postings VALUES (?,?,?,?,?,?)')
      .run('t1:0000', 't1', 'banco', '-45000', 'COP', null);
    sqlite
      .prepare('INSERT INTO postings VALUES (?,?,?,?,?,?)')
      .run('t1:0001', 't1', 'gasto', corromper ? '1' : '45000', 'COP', null);
    sqlite.close();
    return ruta;
  };

  const ejecutar = (ruta: string): { salida: string; codigo: number } => {
    try {
      return {
        salida: execFileSync('npx', ['tsx', 'scripts/verificar-ledger.ts', ruta], {
          cwd: join(__dirname, '..'),
          encoding: 'utf8',
        }),
        codigo: 0,
      };
    } catch (error) {
      const fallo = error as { stdout?: string; status?: number };
      return { salida: fallo.stdout ?? '', codigo: fallo.status ?? -1 };
    }
  };

  beforeAll(() => {
    carpeta = mkdtempSync(join(tmpdir(), 'sereno-ledger-'));
  });

  afterAll(() => {
    rmSync(carpeta, { recursive: true, force: true });
  });

  it('sobre una base sana informa que cuadra y sale con código 0', () => {
    const { salida, codigo } = ejecutar(crearBase(false));

    expect(salida).toContain('Revisado: 2 cuentas, 1 transacciones, 2 apuntes');
    expect(salida).toContain('El ledger cuadra');
    expect(codigo).toBe(0);
  });

  it('sobre una base corrupta nombra la violación y sale con código 1', () => {
    const { salida, codigo } = ejecutar(crearBase(true));

    expect(salida).toContain('transaccion-cuadrada');
    expect(salida).toContain('"t1"');
    // El código de salida es lo que permite encadenarlo en un guion.
    expect(codigo).toBe(1);
  });

  it('sin argumento explica cómo usarlo, sin fingir que revisó algo', () => {
    const { codigo } = ejecutar('');

    expect(codigo).not.toBe(0);
  });
});
