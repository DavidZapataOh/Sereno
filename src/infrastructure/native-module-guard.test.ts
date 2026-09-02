import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { archivosDeCodigo } from '@/test/source-files';

const RAIZ = join(__dirname, '..');

/**
 * Módulos nativos que **no se pueden importar arriba del archivo**.
 *
 * `expo-notifications` revienta **al importarse** en Android bajo Expo Go desde
 * SDK 53. No al usarse: al importarse. Un `import` normal en un archivo que
 * cuelgue de la composición tumba la app entera al arrancar, y ninguna prueba
 * lo ve porque en Jest el módulo está doblado.
 *
 * Pasó el 2026-09-01: todas las rutas cayeron con «missing the required default
 * export» por un módulo que ninguna pantalla usaba. La documentación de Expo
 * decía que los avisos locales sí funcionan en Expo Go —y es verdad a medias:
 * la funcionalidad sí, el import no—.
 *
 * Estos se cargan **dentro de una función y entre `try`**, para que «no
 * disponible» sea un estado que se enseña en vez de una app que no abre.
 */
const PELIGROSOS = ['expo-notifications'];

describe('módulos nativos que revientan al importarse', () => {
  it.each(PELIGROSOS)('«%s» no se importa en la cabecera de ningún archivo', (modulo) => {
    const culpables: string[] = [];

    for (const ruta of archivosDeCodigo(RAIZ)) {
      const contenido = readFileSync(ruta, 'utf8');
      // Un `import ... from 'modulo'` estático. El `require` dentro de una
      // función está permitido: es justamente el arreglo.
      const estatico = new RegExp(`^\\s*import[^;]*from\\s+['"]${modulo}['"]`, 'm');
      if (estatico.test(contenido)) culpables.push(ruta);
    }

    expect(culpables).toEqual([]);
  });

  /**
   * Y que el arreglo siga en pie: el planificador tiene que cargarlo tarde.
   */
  it('el planificador de avisos lo carga dentro de una función', () => {
    const contenido = readFileSync(
      join(RAIZ, 'infrastructure/notifications/local-scheduler.ts'),
      'utf8',
    );

    expect(contenido).toMatch(/require\('expo-notifications'\)/);
    expect(contenido).toMatch(/catch/);
  });
});
