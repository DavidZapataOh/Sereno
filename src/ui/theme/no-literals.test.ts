import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');

/** Archivos donde SÍ pueden aparecer colores literales. */
const PERMITIDOS = ['ui/theme/palette.ts', 'ui/theme/palette.test.ts', 'ui/theme/contrast.test.ts'];

/**
 * Lo que se busca.
 *
 * Hex de 3, 4, 6 y 8 dígitos; funciones de color; y los nombres de color más
 * habituales cuando van como valor de una propiedad de estilo. Los nombres no
 * se buscan sueltos porque «white» aparece en textos legítimos.
 */
const PATRONES: readonly RegExp[] = [
  // El `(?<!&)` descarta las entidades HTML numéricas —`&#160;`, `&#8364;`—,
  // que no son colores: un hex nunca se escribe precedido de «&». Apareció con
  // las pruebas del parser de correo del sprint 06.
  /(?<!&)#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3,4})\b/g,
  /\b(?:rgba?|hsla?)\(/g,
  /\b(?:color|backgroundColor|borderColor|tintColor|shadowColor)\s*:\s*['"](?:white|black|red|green|blue|gray|grey|transparent)['"]/g,
];

function archivosFuente(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      archivosFuente(ruta, acc);
    } else if (/\.tsx?$/.test(entrada)) {
      acc.push(ruta);
    }
  }
  return acc;
}

/**
 * Prohíbe los colores escritos a mano.
 *
 * Es la única forma de que la regla «usa siempre los tokens» sobreviva. La
 * disciplina se erosiona con el primer blanco puesto a mano con prisa, y nadie lo
 * detecta en revisión porque se ve bien. Esta prueba sí lo detecta.
 */
describe('valores literales de color', () => {
  it('ningún archivo fuera de la paleta contiene un color literal', () => {
    const infractores: string[] = [];

    for (const ruta of archivosFuente(RAIZ)) {
      const relativa = ruta.slice(RAIZ.length + 1).replace(/\\/g, '/');
      if (PERMITIDOS.some((permitido) => relativa.endsWith(permitido))) continue;

      const contenido = readFileSync(ruta, 'utf8');
      const encontrados = PATRONES.flatMap((patron) => contenido.match(patron) ?? []);
      if (encontrados.length > 0) {
        infractores.push(`${relativa}: ${encontrados.join(', ')}`);
      }
    }

    expect(infractores).toEqual([]);
  });

  it('la lista de permitidos solo contiene archivos que existen', () => {
    // Un permitido que ya no existe es una excepción que nadie recuerda por qué
    // está ahí, y acabaría cubriendo un archivo nuevo con el mismo sufijo.
    const existentes = archivosFuente(RAIZ).map((ruta) => ruta.slice(RAIZ.length + 1));
    PERMITIDOS.forEach((permitido) => {
      expect(existentes.some((ruta) => ruta.endsWith(permitido))).toBe(true);
    });
  });
});
