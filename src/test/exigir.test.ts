import { exigir } from './exigir';

describe('exigir', () => {
  it('devuelve el valor cuando existe', () => {
    expect(exigir('hola')).toBe('hola');
  });

  it('deja pasar valores falsy que sí son valores', () => {
    expect(exigir(0)).toBe(0);
    expect(exigir('')).toBe('');
    expect(exigir(false)).toBe(false);
  });

  it('lanza cuando el valor es undefined', () => {
    expect(() => {
      exigir(undefined);
    }).toThrow('Se esperaba un valor');
  });

  it('lanza cuando el valor es null', () => {
    expect(() => {
      exigir(null);
    }).toThrow('Se esperaba un valor');
  });

  it('nombra qué faltaba, para no tener que adivinar en el fallo', () => {
    expect(() => {
      exigir(undefined, 'la primera transacción');
    }).toThrow('Se esperaba la primera transacción y no llegó nada');
  });
});
