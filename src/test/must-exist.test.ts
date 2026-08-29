import { mustExist } from './must-exist';

describe('mustExist', () => {
  it('devuelve el valor cuando existe', () => {
    expect(mustExist('hola')).toBe('hola');
  });

  it('deja pasar valores falsy que sí son valores', () => {
    expect(mustExist(0)).toBe(0);
    expect(mustExist('')).toBe('');
    expect(mustExist(false)).toBe(false);
  });

  it('lanza cuando el valor es undefined', () => {
    expect(() => {
      mustExist(undefined);
    }).toThrow('Se esperaba un valor');
  });

  it('lanza cuando el valor es null', () => {
    expect(() => {
      mustExist(null);
    }).toThrow('Se esperaba un valor');
  });

  it('nombra qué faltaba, para no tener que adivinar en el fallo', () => {
    expect(() => {
      mustExist(undefined, 'la primera transacción');
    }).toThrow('Se esperaba la primera transacción y no llegó nada');
  });
});
