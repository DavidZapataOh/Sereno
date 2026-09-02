import { readFileSync } from 'node:fs';

import { archivosDeCodigo } from '@/test/source-files';

/**
 * Que ningún pulsable se escape.
 *
 * Es una guarda estática, del mismo tipo que `native-module-guard.test.ts`:
 * lee el código en vez de ejecutarlo. Y por eso llega a `src/app/`, que es
 * justo donde no hay pruebas de render —probar una ruta exige doblar la base
 * de datos, y este proyecto no lo hace en ninguna—.
 *
 * Tres cosas, y ninguna es sutil:
 *
 * - **Rol**: sin él, el lector de pantalla no dice que aquello se puede tocar.
 * - **Etiqueta**: sin ella, dice «botón» y nada más.
 * - **Altura mínima**: 44 puntos no son una preferencia estética, son lo que
 *   un dedo acierta. Un pulsable de 20 px se falla la mitad de las veces, y
 *   quien lo sufre no sabe que el problema es el tamaño.
 */
describe('todo lo que se pulsa es accesible', () => {
  /** Cada `<Pressable ...>` con lo que lo acompaña, archivo por archivo. */
  const pulsables = archivosDeCodigo()
    .filter((ruta) => ruta.startsWith('src/ui/') || ruta.startsWith('src/app/'))
    .flatMap((ruta) => {
      const codigo = readFileSync(ruta, 'utf8');
      return codigo
        .split('<Pressable')
        .slice(1)
        .map((trozo, indice) => ({
          ruta: `${ruta} (pulsable ${String(indice + 1)})`,
          // El elemento entero: el estilo con la altura vive dentro.
          cuerpo: trozo.split('</Pressable>')[0] ?? trozo,
        }));
    });

  it('hay pulsables que revisar', () => {
    expect(pulsables.length).toBeGreaterThan(5);
  });

  it('todos declaran su rol', () => {
    expect(
      pulsables.filter((p) => !p.cuerpo.includes('accessibilityRole')).map((p) => p.ruta),
    ).toEqual([]);
  });

  it('todos dicen qué son, no solo que son un botón', () => {
    expect(
      pulsables.filter((p) => !p.cuerpo.includes('accessibilityLabel')).map((p) => p.ruta),
    ).toEqual([]);
  });

  /** 44 puntos no es una preferencia: es lo que un dedo acierta. */
  it('todos declaran una altura mínima que un dedo acierte', () => {
    expect(
      pulsables
        .filter((p) => !p.cuerpo.includes('touchTargetMin') && !p.cuerpo.includes('minHeight'))
        .map((p) => p.ruta),
    ).toEqual([]);
  });
});
