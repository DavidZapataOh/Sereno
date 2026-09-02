import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(__dirname, '..');

/**
 * Todos los archivos de código de `src/`, **sin las pruebas**.
 *
 * Lo usan las guardas que leen el código fuente en vez de ejecutarlo: las que
 * vigilan cosas que ninguna prueba de comportamiento puede ver —un módulo
 * nativo importado arriba, un color a mano, un temporizador sin cancelar—.
 *
 * Las rutas vuelven relativas a la raíz del proyecto, para que cuando una
 * guarda falle se pueda pinchar el archivo.
 */
export function archivosDeCodigo(directorio: string = RAIZ): string[] {
  const encontrados: string[] = [];

  const recorrer = (dir: string): void => {
    for (const entrada of readdirSync(dir)) {
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) {
        recorrer(ruta);
      } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
        encontrados.push(relative(process.cwd(), ruta));
      }
    }
  };

  recorrer(directorio);
  return encontrados;
}
