import { assert, integer, property } from 'fast-check';

import { cuerpoDe, fechaColombiana, montoColombiano, textoPlano } from './extraccion';

describe('montoColombiano', () => {
  // Los catorce son los montos reales de los correos de David. Bancolombia
  // mezcla los dos formatos EN EL MISMO EMISOR.
  it.each([
    ['Compraste $10.700,00 en JOHN JAIRO', 10700],
    ['pagaste $170,000.00 por codigo QR', 170000],
    ['Pagaste $124,000.00 a UNE EPM', 124000],
    ['consignacion por $500,000 desde', 500000],
    ['transferencia de Coloca SAS por $360,000.00 en', 360000],
    ['transferencia por $5,000 de CLARA', 5000],
    ['Retiraste $40.000,00 en SUC_CRA70_3', 40000],
    ['Transferiste $10,000.00 desde tu cuenta', 10000],
    ['tu factura por $5.000 Estado: Exitoso', 5000],
    ['La tiquetera S.A.S por $194.230 Fecha', 194230],
    ['Recibiste 350.000 de Coloca SAS', 350000],
    ['Tu pago fue de $99.799,30 Lo has', 99799],
    ['Monto 140.378,92 Cashback', 140378],
    ['Monto $235.690 Método de pago', 235690],
  ])('lee «%s» como %i', (texto, esperado) => {
    expect(montoColombiano(texto)).toBe(esperado);
  });

  it('trunca los centavos en vez de redondear', () => {
    // Redondear inventa pesos que el banco no movió.
    expect(montoColombiano('$999,99')).toBe(999);
    expect(montoColombiano('$999.99')).toBe(999);
  });

  it('sin monto devuelve null, no cero', () => {
    expect(montoColombiano('Tu extracto ya está disponible')).toBeNull();
    expect(montoColombiano('')).toBeNull();
  });

  it('toma el primer monto del texto, que es el de la transacción', () => {
    expect(montoColombiano('Compra por $45.000. Cupo disponible $2.000.000')).toBe(45000);
  });

  it('propiedad: lo que se formatea como peso se vuelve a leer igual, en los dos formatos', () => {
    assert(
      property(integer({ min: 0, max: 999_999_999 }), (n) => {
        const conPuntos = `$${n.toLocaleString('es-CO')}`;
        const conComas = `$${n.toLocaleString('en-US')}`;
        return montoColombiano(conPuntos) === n && montoColombiano(conComas) === n;
      }),
    );
  });
});

describe('fechaColombiana', () => {
  // Los diez formatos son los reales. Hay año de dos cifras, mes en letras,
  // mes abreviado, ISO, y `a. m.` / `PM`.
  it.each([
    ['el 28/08/2026 a las 13:05.', '2026-08-28T13:05:00.000-05:00'],
    ['desde tu producto 7045 el 19/08/2026 17:29:38.', '2026-08-19T17:29:38.000-05:00'],
    ['en HISPANIA, el 24/08/26 10:24.', '2026-08-24T10:24:00.000-05:00'],
    ['el 15/08/26 a las 15:51.', '2026-08-15T15:51:00.000-05:00'],
    ['Fecha: 05/Jul/2026 Paquete', '2026-07-05T00:00:00.000-05:00'],
    ['Fecha: El 11 de agosto de 2026 Hora: 8:25 a. m. CUS', '2026-08-11T08:25:00.000-05:00'],
    ['el 10 de julio de 2026 a las 5:47 p.m, desde', '2026-07-10T17:47:00.000-05:00'],
    ['Lo has realizado el 10 mayo 2026 8:03:31 PM Tipo', '2026-05-10T20:03:31.000-05:00'],
    ['Fecha y hora 25 ago 2026 06:55 Método', '2026-08-25T06:55:00.000-05:00'],
    ['Fecha de la transacción 2025-06-12 12:57:20', '2025-06-12T12:57:20.000-05:00'],
  ])('lee «%s»', (texto, esperado) => {
    expect(fechaColombiana(texto)).toBe(esperado);
  });

  it('las doce de la noche y las doce del día no se confunden', () => {
    expect(fechaColombiana('el 05/07/2026 a las 12:30 a. m.')).toBe(
      '2026-07-05T00:30:00.000-05:00',
    );
    expect(fechaColombiana('el 05/07/2026 a las 12:30 p. m.')).toBe(
      '2026-07-05T12:30:00.000-05:00',
    );
  });

  it('una fecha que no existe no se acepta', () => {
    expect(fechaColombiana('30/02/2026')).toBeNull();
    expect(fechaColombiana('sin fecha por ningún lado')).toBeNull();
  });
});

describe('textoPlano y cuerpoDe', () => {
  it('quita etiquetas, resuelve entidades y junta espacios', () => {
    expect(textoPlano('<p>Compra&nbsp;por <b>$45.000</b></p>\n<p>en&#160;ÉXITO</p>')).toBe(
      'Compra por $45.000 en ÉXITO',
    );
    expect(textoPlano('<style>p{color:red}</style><p>Hola</p>')).toBe('Hola');
    expect(textoPlano('Caf&eacute; &amp; pan &lt;3')).toBe('Café & pan <3');
  });

  it('el cuerpo es el texto, y si no hay, el HTML aplanado', () => {
    expect(cuerpoDe({ texto: 'plano', html: '<p>otro</p>' })).toBe('plano');
    expect(cuerpoDe({ texto: '   ', html: '<p>del html</p>' })).toBe('del html');
    expect(cuerpoDe({ texto: '', html: null })).toBe('');
  });
});
