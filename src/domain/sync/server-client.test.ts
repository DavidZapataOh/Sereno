import { serverPageSchema } from './server-client';

const movimiento = {
  id: 'bancolombia:A',
  secuencia: 1,
  fecha: '2026-08-30T10:00:00.000-05:00',
  descripcion: 'COMPRA',
  monto: 45000,
  moneda: 'COP',
  tipo: 'debito',
  fuente: 'bancolombia',
  referencia: 'A',
};

describe('esquema de la página del servidor', () => {
  it('acepta una página bien formada', () => {
    const pagina = { movimientos: [movimiento], cursor: 1, hayMas: false };
    expect(serverPageSchema.parse(pagina)).toEqual(pagina);
  });

  it('rechaza lo que el ledger no podría digerir', () => {
    // Una respuesta rara es un error ruidoso, no un undefined que viaja hasta
    // el saldo. Es la regla del sprint 00: validar en el borde.
    const casos = [
      { ...movimiento, monto: -1 },
      { ...movimiento, monto: 45000.5 },
      { ...movimiento, fuente: 'davivienda' },
      { ...movimiento, tipo: 'otra-cosa' },
      { ...movimiento, id: '' },
    ];
    for (const malo of casos) {
      expect(() =>
        serverPageSchema.parse({ movimientos: [malo], cursor: 1, hayMas: false }),
      ).toThrow();
    }
  });

  it('rechaza una página sin cursor o con cursor negativo', () => {
    expect(() => serverPageSchema.parse({ movimientos: [], hayMas: false })).toThrow();
    expect(() => serverPageSchema.parse({ movimientos: [], cursor: -1, hayMas: false })).toThrow();
  });
});
