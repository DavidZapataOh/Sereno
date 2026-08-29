/**
 * Devuelve el valor comprobando que exista.
 *
 * Con `noUncheckedIndexedAccess` activado, `arreglo[0]` es `T | undefined`. En
 * las pruebas eso obliga a encadenar `?.` en cada aserción, lo que las debilita:
 * `expect(x?.campo).toBe(y)` pasa igual si `x` es `undefined` y `y` también.
 * Este ayudante falla en el sitio, con un mensaje que dice qué faltaba.
 */
export function exigir<T>(valor: T | undefined | null, que = 'un valor'): T {
  if (valor === undefined || valor === null) {
    throw new Error(`Se esperaba ${que} y no llegó nada`);
  }
  return valor;
}
