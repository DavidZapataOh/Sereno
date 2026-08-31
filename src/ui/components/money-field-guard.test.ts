import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');

/**
 * Dónde SÍ puede aparecer un teclado numérico a mano.
 *
 * Solo el componente que lo encapsula. Si algún día hace falta un campo
 * numérico que no sea dinero —una cantidad, un plazo—, se añade aquí con su
 * motivo escrito, y esa discusión es exactamente la que esta prueba quiere
 * provocar.
 */
const PERMITIDOS = ['ui/components/text-field.tsx'];

const TECLADO_NUMERICO = /keyboardType\s*=\s*[{"']?["']?(?:number-pad|numeric|decimal-pad)/g;

function archivosFuente(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      archivosFuente(ruta, acc);
    } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      acc.push(ruta);
    }
  }
  return acc;
}

/**
 * Prohíbe escribir un campo de dinero a mano.
 *
 * `MoneyField` existe para que **todos** los montos se escriban igual:
 * separadores de miles mientras se teclea, solo dígitos, y un `bigint` al
 * salir. Es lo mismo que `Money` hace al mostrar.
 *
 * La regla se rompió en el sprint 07: el formulario de tarjetas usó un
 * `TextField` con el teclado numérico y quedó como el único campo de dinero de
 * la app sin formato. En revisión no se ve —el formulario funciona—, y lo
 * encontró David usándolo. Esta prueba sí lo ve.
 */
describe('campos de dinero', () => {
  it('ninguna pantalla monta su propio campo numérico: para eso está MoneyField', () => {
    const infractores: string[] = [];

    for (const ruta of archivosFuente(RAIZ)) {
      const relativa = ruta.slice(RAIZ.length + 1).replace(/\\/g, '/');
      if (PERMITIDOS.some((permitido) => relativa.endsWith(permitido))) continue;

      const encontrados = readFileSync(ruta, 'utf8').match(TECLADO_NUMERICO) ?? [];
      if (encontrados.length > 0) {
        infractores.push(`${relativa}: ${encontrados.join(', ')}`);
      }
    }

    expect(infractores).toEqual([]);
  });

  it('la lista de permitidos solo contiene archivos que existen', () => {
    const existentes = archivosFuente(RAIZ).map((ruta) => ruta.slice(RAIZ.length + 1));
    PERMITIDOS.forEach((permitido) => {
      expect(existentes.some((ruta) => ruta.endsWith(permitido))).toBe(true);
    });
  });
});
