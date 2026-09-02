import { readFileSync } from 'node:fs';

import { archivosDeCodigo } from '@/test/source-files';

/**
 * Alturas fijas en cajas que llevan texto.
 *
 * Es la causa habitual de que una pantalla se recorte cuando alguien pone la
 * letra del sistema al doble: la caja no crece, el texto sí, y lo que sobra
 * desaparece. `minHeight` sí vale —crece—; `height` no.
 *
 * **Lo que esta guarda NO demuestra:** que la app se vea bien al 200 %. Jest no
 * mide maquetación, y una prueba que dijera eso estaría mintiendo. Lo que hace
 * es quitar de en medio la causa más común, para que la sesión con el teléfono
 * encuentre lo que de verdad haya que mirar.
 *
 * Una altura fija legítima —la barra de una gráfica es un dibujo, no texto— se
 * declara en el código con `altura-fija:` y su motivo. La excepción se escribe
 * donde está, no en una lista aparte que nadie vuelve a leer.
 */
describe('nada con texto tiene la altura clavada', () => {
  const ALTURA_FIJA = /(?<!min|max)height:\s*(\d|ALTURA)/;

  const culpables = archivosDeCodigo()
    .filter((ruta) => /^src\/(ui|app)\//.test(ruta) && ruta.endsWith('.tsx'))
    .flatMap((ruta) => {
      const lineas = readFileSync(ruta, 'utf8').split('\n');
      return lineas
        .map((linea, i) => ({ linea, i }))
        .filter(({ linea, i }) => {
          if (!ALTURA_FIJA.test(linea)) return false;
          // La excepción se declara al lado: en la misma línea o en las tres
          // anteriores, que es donde cabe el comentario que la explica.
          const contexto = lineas.slice(Math.max(0, i - 3), i + 1).join('\n');
          return !contexto.includes('altura-fija:');
        })
        .map(({ i }) => `${ruta}:${String(i + 1)}`);
    });

  it('ninguna altura fija sin declarar por qué', () => {
    expect(culpables).toEqual([]);
  });
});
