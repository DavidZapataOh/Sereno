import { assert, property, string } from 'fast-check';

import { cleanDescription, merchantCoverage, merchantOf, titleCase, tokensOf } from './merchant';
import { SAMPLE_DESCRIPTIONS } from './sample-descriptions';

describe('cleanDescription', () => {
  it('quita sucursal y ciudad además del ruido del banco', () => {
    expect(cleanDescription('COMPRA PSE *4471 EXITO SUR BOGOTA')).toBe('exito');
    expect(cleanDescription('COMPRA TIENDA LA 14 CALLE 80 NORTE')).toBe('tienda la 14');
    expect(cleanDescription('PAGO EN PANADERIA DONA ROSA CC PLAZA')).toBe('panaderia dona rosa');
  });

  it('nunca devuelve vacío si había letras', () => {
    expect(cleanDescription('SUR')).toBe('sur');
    assert(
      property(string({ minLength: 1, maxLength: 40 }), (s) => {
        if (!/[a-zA-Z]/.test(s)) return true;
        return cleanDescription(s).length > 0;
      }),
    );
  });
});

describe('tokensOf', () => {
  it('palabras limpias de dos o más letras, sin números ni repetidos', () => {
    expect(tokensOf('COMPRA PSE *4471 EXITO SUR 80 EXITO')).toEqual(['exito']);
    expect(tokensOf('PAGO EN PANADERIA DONA ROSA')).toEqual(['panaderia', 'dona', 'rosa']);
  });
});

describe('titleCase', () => {
  it('mayúscula inicial por palabra, conectores en minúscula', () => {
    expect(titleCase('panaderia dona rosa')).toBe('Panaderia Dona Rosa');
    expect(titleCase('tienda de la esquina')).toBe('Tienda de la Esquina');
  });
});

describe('merchantOf', () => {
  it('con catálogo: nombre de marca, clave estable y categoría sugerida', () => {
    const a = merchantOf('COMPRA PSE *4471 EXITO SUR');
    const b = merchantOf('ALMACENES EXITO SA BOGOTA');
    expect(a).toEqual({
      nombre: 'Éxito',
      clave: 'exito',
      conocido: true,
      categoriaSugerida: 'mercado',
    });
    expect(b.clave).toBe(a.clave);
  });

  it('sin catálogo: las variantes de sucursal comparten clave', () => {
    const a = merchantOf('COMPRA PANADERIA DONA ROSA SUR');
    const b = merchantOf('PAGO EN PANADERIA DONA ROSA CALLE 80');
    expect(a.conocido).toBe(false);
    expect(a.categoriaSugerida).toBeNull();
    expect(a.nombre).toBe('Panaderia Dona Rosa');
    expect(a.clave).toBe('panaderia dona');
    expect(b.clave).toBe(a.clave);
  });

  it('una transferencia entre cuentas propias se reconoce sin categoría', () => {
    expect(merchantOf('TRANSFERENCIA A NEQUI')).toMatchObject({
      nombre: 'Nequi',
      conocido: true,
      categoriaSugerida: null,
    });
  });

  it('si solo queda ruido, el nombre es la base y no una cadena vacía', () => {
    const m = merchantOf('COMPRA');
    expect(m.nombre.length).toBeGreaterThan(0);
    expect(m.clave.length).toBeGreaterThan(0);
  });

  it('propiedad: nombre y clave nunca vacíos; la clave es determinista', () => {
    assert(
      property(string({ minLength: 1, maxLength: 60 }), (s) => {
        if (!/[a-zA-Z]/.test(s)) return true;
        const m = merchantOf(s);
        return m.nombre.length > 0 && m.clave.length > 0 && merchantOf(s).clave === m.clave;
      }),
    );
  });
});

describe('merchantCoverage', () => {
  it('reconoce al menos el 70 % de la muestra con forma real', () => {
    const r = merchantCoverage(SAMPLE_DESCRIPTIONS);
    expect(r.total).toBe(SAMPLE_DESCRIPTIONS.length);
    expect(r.proporcion).toBeGreaterThanOrEqual(0.7);
  });

  it('lista lo desconocido por frecuencia, para saber qué añadir al catálogo', () => {
    const r = merchantCoverage(['COMPRA TIENDA X', 'COMPRA TIENDA X SUR', 'COMPRA OTRA COSA']);
    expect(r.conocidos).toBe(0);
    expect(r.desconocidos[0]).toEqual({ clave: 'tienda x', veces: 2 });
  });

  it('con una lista vacía, proporción 0 y sin división por cero', () => {
    expect(merchantCoverage([])).toEqual({
      total: 0,
      conocidos: 0,
      proporcion: 0,
      desconocidos: [],
    });
  });
});

/**
 * David, primera transferencia de verdad tras conectar el correo: el
 * movimiento se tituló «La Cuenta». Quitarle el prefijo del banco y el número
 * de cuenta a «Transferencia a la cuenta *3218502671» no deja comercio, deja
 * relleno.
 */
describe('descripciones que no nombran a nadie', () => {
  it('no titula un movimiento «La Cuenta»', () => {
    const m = merchantOf('Transferencia a la cuenta *3218502671');

    expect(m.nombre).toBe('Transferencia a la cuenta *3218502671');
    expect(m.conocido).toBe(false);
  });

  it('agrupa por el tipo de movimiento, no por el número de cuenta', () => {
    const a = merchantOf('Transferencia a la cuenta *3218502671');
    const b = merchantOf('Transferencia a la cuenta *9999999999');

    expect(a.clave).toBe(b.clave);
    expect(a.nombre).not.toBe(b.nombre);
  });

  it('un comercio de verdad sigue saliendo como comercio', () => {
    expect(merchantOf('Compra en EXITO SUR').conocido).toBe(true);
    expect(merchantOf('Pago por QR a la llave 3001234567').nombre).not.toBe('La Llave');
  });
});
