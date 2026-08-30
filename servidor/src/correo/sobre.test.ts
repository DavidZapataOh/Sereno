import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { cifrar, claveDesde, descifrar } from './sobre';

const clave = randomBytes(32);
const otra = randomBytes(32);

describe('sobre cifrado', () => {
  it('lo cifrado vuelve igual, incluidos acentos y saltos de línea', () => {
    const original = 'Compra por $ 45.000 en ÉXITO SUR\nTarjeta ****8901';
    expect(descifrar(cifrar(original, clave), clave)).toBe(original);
  });

  it('cifrar dos veces lo mismo da dos textos distintos', () => {
    // Si el IV se repitiera, dos correos iguales serían visiblemente iguales
    // en la base, y eso ya dice algo de su contenido.
    expect(cifrar('hola', clave)).not.toBe(cifrar('hola', clave));
  });

  it('con otra clave no se abre', () => {
    expect(() => descifrar(cifrar('hola', clave), otra)).toThrow();
  });

  it('un sobre alterado no se abre en silencio', () => {
    const sobre = cifrar('hola', clave);
    expect(() => descifrar(`${sobre.slice(0, -4)}AAAA`, clave)).toThrow();
  });

  it('un sobre con forma inválida se rechaza con un mensaje que se entiende', () => {
    expect(() => descifrar('no-soy-un-sobre', clave)).toThrow(/sobre/i);
    expect(() => descifrar('v2.a.b.c', clave)).toThrow(/sobre/i);
  });

  it('un texto vacío también va y vuelve', () => {
    expect(descifrar(cifrar('', clave), clave)).toBe('');
  });

  it('la clave tiene que medir 32 bytes, y se dice si no', () => {
    expect(claveDesde(clave.toString('base64'))).toHaveLength(32);
    expect(() => claveDesde('Y29ydGE=')).toThrow(/32 bytes/);
  });
});
