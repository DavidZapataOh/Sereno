import { readFileSync } from 'node:fs';

import { archivosDeCodigo } from '@/test/source-files';

/**
 * Ninguna duración ni curva escrita a mano.
 *
 * Es la hermana de `no-literals.test.ts` con los colores, y existe por lo
 * mismo: la disciplina se erosiona con el primer `duration: 250` puesto con
 * prisa, y nadie lo ve en una revisión porque se ve bien. A los seis meses hay
 * doce ritmos distintos y la app se siente descosida sin que se sepa por qué.
 *
 * Todo sale de `ui/theme/motion.ts`, que es el único archivo donde estos
 * números pueden aparecer.
 */
describe('valores de movimiento', () => {
  const PERMITIDOS = ['ui/theme/motion.ts', 'ui/theme/tokens.ts'];

  /**
   * Lo que se busca: un número donde va una duración o una curva.
   *
   * No se buscan números sueltos —los hay legítimos por todas partes— sino los
   * que ocupan el sitio de un token de movimiento.
   */
  const PATRONES: readonly RegExp[] = [
    /\bduration:\s*\d+/g,
    /\bwithTiming\([^,)]+,\s*\{\s*duration:\s*\d+/g,
    /\bwithSpring\([^,)]+,\s*\{\s*(damping|stiffness|mass):\s*[\d.]+/g,
    /\bEasing\.[a-z]/gi,
    /\banimationDuration:\s*\d+/g,
  ];

  /**
   * Se miran los comentarios aparte del código.
   *
   * La primera versión de esta guarda se señaló a sí misma: el ejemplo que
   * aparece ahí arriba, dentro de este mismo comentario, encaja con el patrón.
   * Un comentario no se ejecuta, así que no puede descoser nada.
   */
  const sinComentarios = (codigo: string): string =>
    codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('ninguna duración ni curva fuera de los tokens', () => {
    const infractores: string[] = [];

    for (const ruta of archivosDeCodigo(undefined, { conPruebas: true })) {
      const relativa = ruta.replace(/\\/g, '/').replace(/^src\//, '');
      if (PERMITIDOS.some((permitido) => relativa.endsWith(permitido))) continue;

      const contenido = sinComentarios(readFileSync(ruta, 'utf8'));
      const encontrados = PATRONES.flatMap((patron) => contenido.match(patron) ?? []);
      if (encontrados.length > 0) infractores.push(`${relativa}: ${encontrados.join(', ')}`);
    }

    expect(infractores).toEqual([]);
  });

  it('la lista de permitidos solo contiene archivos que existen', () => {
    const existentes = archivosDeCodigo(undefined, { conPruebas: true }).map((ruta) =>
      ruta.replace(/^src\//, ''),
    );
    for (const permitido of PERMITIDOS) {
      expect(existentes.some((ruta) => ruta.endsWith(permitido))).toBe(true);
    }
  });
});
