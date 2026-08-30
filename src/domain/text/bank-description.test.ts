import { assert, property, string } from 'fast-check';

import { basicClean, stripAccents, stripBankPrefix, stripTerminals } from './bank-description';

describe('stripAccents', () => {
  it('quita tildes y diéresis sin tocar lo demás', () => {
    expect(stripAccents('Éxito Cañón Ü')).toBe('Exito Canon U');
  });
});

describe('stripBankPrefix', () => {
  it('quita el tipo de movimiento y su conector', () => {
    expect(stripBankPrefix('compra pse exito sur')).toBe('exito sur');
    expect(stripBankPrefix('pago en rappi')).toBe('rappi');
    expect(stripBankPrefix('transferencia a nequi')).toBe('nequi');
    expect(stripBankPrefix('abono de nomina')).toBe('nomina');
  });

  it('no se come un comercio que se llama como el conector', () => {
    // Lo encontró fast-check en el sprint 04: «COMPRA A» → comercio «A».
    expect(stripBankPrefix('compra a')).toBe('a');
    expect(stripBankPrefix('pago en')).toBe('en');
  });

  it('sin prefijo conocido devuelve el texto tal cual', () => {
    expect(stripBankPrefix('netflix.com')).toBe('netflix.com');
  });
});

describe('stripTerminals', () => {
  it('quita terminales y autorizaciones', () => {
    expect(stripTerminals('*4471 exito sur')).toBe('exito sur');
    expect(stripTerminals('uber *trip help.uber.com')).toBe('uber help.uber.com');
    expect(stripTerminals('rappi 004512983 bogota')).toBe('rappi bogota');
  });

  it('no quita números cortos: pueden ser parte del nombre', () => {
    expect(stripTerminals('calle 80 tienda d1')).toBe('calle 80 tienda d1');
  });
});

describe('basicClean', () => {
  it('encadena: sin acentos, minúsculas, sin terminal, sin prefijo', () => {
    expect(basicClean('COMPRA PSE *4471 ÉXITO SUR')).toBe('exito sur');
  });

  it('si todo era ruido devuelve la base y nunca una cadena vacía', () => {
    expect(basicClean('COMPRA')).toBe('compra');
  });

  it('propiedad: nunca devuelve vacío si la entrada tiene alguna letra', () => {
    assert(
      property(string({ minLength: 1, maxLength: 40 }), (s) => {
        if (!/[a-zA-Z]/.test(s)) return true;
        return basicClean(s).length > 0;
      }),
    );
  });

  it('propiedad: es idempotente', () => {
    assert(
      property(string({ minLength: 1, maxLength: 40 }), (s) => {
        const una = basicClean(s);
        return basicClean(una) === una;
      }),
    );
  });
});
