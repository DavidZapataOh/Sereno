import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..');
const leer = (ruta: string): string => readFileSync(join(raiz, ruta), 'utf8');

/**
 * Dos cosas del despliegue que no se notan hasta que ya es tarde.
 *
 * La primera: Railway solo mira su configuración en la raíz del repositorio.
 * Con el archivo dentro de `servidor/` lo ignora, intenta adivinar cómo se
 * construye esto, y adivina mal.
 *
 * La segunda: el contexto de construcción es la raíz entera, así que todo lo
 * que no esté excluido se sube al constructor. Ahí viven los correos reales
 * de `capturas/` y la contraseña de aplicación de `servidor/.env`.
 */
describe('configuración de despliegue', () => {
  it('deja la configuración de Railway en la raíz, que es donde la busca', () => {
    expect(existsSync(join(raiz, 'railway.json'))).toBe(true);
    expect(existsSync(join(raiz, 'servidor/railway.json'))).toBe(false);
  });

  it('construye con el Dockerfile del servidor', () => {
    const config = JSON.parse(leer('railway.json')) as {
      build: { builder: string; dockerfilePath: string };
    };
    expect(config.build.builder).toBe('DOCKERFILE');
    expect(config.build.dockerfilePath).toBe('servidor/Dockerfile');
  });

  it('mantiene fuera del contexto los datos reales y las credenciales', () => {
    const reglas = leer('.dockerignore')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'));

    // `capturas/` son correos y volcados de verdad; `**/.env`, con dos
    // asteriscos, porque el que importa es `servidor/.env`, no el de la raíz.
    for (const regla of ['capturas', '**/.env', '**/.env.*', '**/node_modules']) {
      expect(reglas).toContain(regla);
    }
    expect(reglas).not.toContain('!**/.env');
  });
});
