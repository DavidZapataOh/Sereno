import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const guion = join(__dirname, 'comprobar-secretos.mjs');
const dirs: string[] = [];

/** Un repositorio de mentira con un archivo dentro, para no ensuciar el real. */
function correr(contenido: string, nombre = 'archivo.ts'): { codigo: number; salida: string } {
  const dir = mkdtempSync(join(tmpdir(), 'secretos-'));
  dirs.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, nombre), contenido);
  execFileSync('git', ['add', '.'], { cwd: dir });
  try {
    return { codigo: 0, salida: execFileSync('node', [guion], { cwd: dir, encoding: 'utf8' }) };
  } catch (error) {
    const e = error as { status: number; stderr: string };
    return { codigo: e.status, salida: e.stderr };
  }
}

describe('comprobar-secretos', () => {
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it('pasa cuando no hay nada que ocultar', () => {
    expect(correr('export const saludo = "hola";').codigo).toBe(0);
  });

  it('caza una contraseña dentro de una URL de Postgres', () => {
    const r = correr('const url = "postgres://sereno:s3cr3t0@db.example.com:5432/sereno";');
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain('Postgres');
  });

  it('caza un token de refresco de Google', () => {
    expect(correr('const t = "1//0abcdefghijklmnopqrstuvwxyz0123456789";').codigo).toBe(1);
  });

  it('caza una clave privada', () => {
    expect(correr('-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n').codigo).toBe(1);
  });

  it('caza una clave de AWS', () => {
    expect(correr('const k = "AKIAIOSFODNN7EXAMPLE";').codigo).toBe(1);
  });

  it('caza un secreto asignado a una variable conocida', () => {
    expect(correr('SERENO_CLAVE_CIFRADO=aGVsbG93b3JsZGhlbGxvd29ybGRoZWxsbw==', '.env').codigo).toBe(
      1,
    );
  });

  it('deja pasar un archivo de ejemplo con las claves vacías', () => {
    expect(correr('SERENO_TOKEN=\nIMAP_CLAVE=\n', '.env.example').codigo).toBe(0);
  });
});
