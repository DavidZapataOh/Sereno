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

  const ejecutar = (...argumentos: string[]): { salida: string; error: string; codigo: number } => {
    try {
      return {
        salida: execFileSync('npx', ['tsx', 'scripts/verificar-ledger.ts', ...argumentos], {
          cwd: join(__dirname, '..'),
          encoding: 'utf8',
        }),
        error: '',
        codigo: 0,
      };
    } catch (fallo) {
      const detalle = fallo as { stdout?: string; stderr?: string; status?: number };
      return {
        salida: detalle.stdout ?? '',
        error: detalle.stderr ?? '',
        codigo: detalle.status ?? -1,
      };
    }
  };

  /**
   * Un volcado de pila es un fallo del programa, no un mensaje al usuario.
   *
   * Esta comprobación existe porque la versión anterior de estas pruebas solo
   * miraba el código de salida, y dejó pasar exactamente eso: llamarlo sin ruta
   * moría con «In-memory/temporary databases cannot be readonly» y treinta
   * líneas de pila. El código de salida era distinto de cero, así que la prueba
   * pasaba.
   */
  const sinVolcadoDePila = (texto: string): void => {
    expect(texto).not.toContain('    at ');
    expect(texto).not.toContain('node_modules');
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

  describe('uso incorrecto', () => {
    it('sin argumento explica cómo usarlo', () => {
      const { error, codigo } = ejecutar();

      expect(error).toContain('Uso: npm run verificar-ledger');
      expect(codigo).toBe(2);
      sinVolcadoDePila(error);
    });

    it('con la ruta vacía explica cómo usarlo, no revienta', () => {
      // `npm run verificar-ledger --` sin ruta pasa una cadena vacía, no
      // `undefined`. Es el caso que se coló.
      const { error, codigo } = ejecutar('');

      expect(error).toContain('Uso: npm run verificar-ledger');
      expect(codigo).toBe(2);
      sinVolcadoDePila(error);
    });

    it('con un archivo que no existe lo dice en una línea', () => {
      const { error, codigo } = ejecutar(join(carpeta, 'no-existe.db'));

      expect(error).toContain('No se puede abrir');
      expect(codigo).toBe(2);
      sinVolcadoDePila(error);
    });

    it('con un archivo que no es una base lo dice en una línea', () => {
      const { error, codigo } = ejecutar(join(__dirname, '../package.json'));

      expect(error).toContain('no parece una base de datos de Sereno');
      expect(codigo).toBe(2);
      sinVolcadoDePila(error);
    });
  });
});
