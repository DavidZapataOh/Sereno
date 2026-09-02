import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { archivosDeCodigo } from '@/test/source-files';

/**
 * Lo que se queda pegado en memoria.
 *
 * Las fugas no se ven en ninguna prueba de comportamiento: la app funciona
 * perfectamente mientras se llena. Se ven leyendo el código, que es lo que
 * hace esto —igual que `native-module-guard.test.ts`, que vigila que nadie
 * importe `expo-notifications` arriba del archivo—.
 *
 * Ninguna de estas reglas es sutil. Son las tres formas de dejar algo abierto
 * en React Native, y las tres se arreglan con la misma línea.
 */
describe('nada se queda abierto', () => {
  const archivos = archivosDeCodigo();

  it('hay archivos que revisar', () => {
    expect(archivos.length).toBeGreaterThan(100);
  });

  it('todo setInterval tiene su clearInterval en el mismo archivo', () => {
    const culpables = archivos.filter((ruta) => {
      const codigo = leer(ruta);
      return codigo.includes('setInterval(') && !codigo.includes('clearInterval(');
    });

    expect(culpables).toEqual([]);
  });

  /**
   * Un temporizador de un segundo que nadie cancela sobrevive a la pantalla que
   * lo creó, y sigue pidiendo datos de una pantalla que ya no existe.
   */
  it('todo setTimeout dentro de un efecto tiene su clearTimeout', () => {
    const culpables = archivos.filter((ruta) => {
      const codigo = leer(ruta);
      if (!codigo.includes('useEffect(')) return false;
      return codigo.includes('setTimeout(') && !codigo.includes('clearTimeout(');
    });

    expect(culpables).toEqual([]);
  });

  /**
   * `addListener` y `addEventListener` devuelven con qué quitarse. No usarlo
   * dentro de un efecto deja la suscripción viva después de que la pantalla
   * desaparezca.
   *
   * **Solo dentro de efectos**, y no en cualquier archivo. La primera versión
   * de esta regla marcaba dos archivos de captura: el doble de `XMLHttpRequest`
   * que *define* un `addEventListener`, y el script inyectado que escucha el
   * `load` de una petición que muere con ella. Ninguno de los dos es una fuga,
   * y una guarda con dos falsos positivos se apaga en la primera semana.
   */
  it('toda suscripción abierta en un efecto se cierra', () => {
    const culpables = archivos.filter((ruta) => {
      const codigo = leer(ruta);
      if (!codigo.includes('useEffect(')) return false;
      const abre = codigo.includes('addListener(') || codigo.includes('addEventListener(');
      const cierra =
        codigo.includes('remove()') ||
        codigo.includes('removeListener(') ||
        codigo.includes('removeEventListener(') ||
        codigo.includes('.remove;');
      return abre && !cierra;
    });

    expect(culpables).toEqual([]);
  });
});

function leer(ruta: string): string {
  return readFileSync(join(process.cwd(), ruta), 'utf8');
}
