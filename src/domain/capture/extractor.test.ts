import { createExtractor, getByPath } from './extractor';
import type { Capture } from './reassembler';
import { mustExist } from '@/test/must-exist';

function capture(body: string): Capture {
  return {
    id: 'a',
    url: 'https://banco.example/api/movimientos',
    method: 'GET',
    status: 200,
    contentType: 'application/json',
    kind: 'fetch',
    capturedAt: '2026-08-28T15:00:00.000Z',
    body,
  };
}

describe('getByPath', () => {
  it('lee una propiedad de primer nivel', () => {
    expect(getByPath({ a: 1 }, 'a')).toBe(1);
  });

  it('lee una propiedad anidada', () => {
    expect(getByPath({ a: { b: { c: 2 } } }, 'a.b.c')).toBe(2);
  });

  it('lee un índice de arreglo', () => {
    expect(getByPath({ a: [{ b: 3 }] }, 'a.0.b')).toBe(3);
  });

  it('devuelve la raíz con ruta vacía', () => {
    expect(getByPath({ a: 1 }, '')).toEqual({ a: 1 });
  });

  it('devuelve undefined si la ruta no existe', () => {
    expect(getByPath({ a: 1 }, 'a.b.c')).toBeUndefined();
  });

  it('devuelve undefined ante null', () => {
    expect(getByPath(null, 'a')).toBeUndefined();
  });
});

describe('createExtractor — por signo del monto', () => {
  const extractor = createExtractor('bancolombia', {
    listPath: 'data.movimientos',
    fecha: 'fechaTransaccion',
    descripcion: 'descripcion',
    monto: 'valor',
    referencia: 'referencia',
  });

  it('extrae un débito a partir del signo negativo', () => {
    const body = JSON.stringify({
      data: {
        movimientos: [
          {
            fechaTransaccion: '2026-08-20',
            descripcion: 'COMPRA EXITO',
            valor: -45000,
            referencia: '4471',
          },
        ],
      },
    });
    expect(extractor(capture(body))).toEqual([
      {
        fecha: '2026-08-20',
        descripcion: 'COMPRA EXITO',
        monto: 45000,
        moneda: 'COP',
        tipo: 'debito',
        fuente: 'bancolombia',
        referencia: '4471',
      },
    ]);
  });

  it('extrae un crédito a partir del signo positivo', () => {
    const body = JSON.stringify({
      data: {
        movimientos: [{ fechaTransaccion: '2026-08-21', descripcion: 'NOMINA', valor: 3200000 }],
      },
    });
    const tx = mustExist(extractor(capture(body))[0]);
    expect(tx.tipo).toBe('credito');
    expect(tx.monto).toBe(3200000);
    expect(tx.referencia).toBeNull();
  });

  it('interpreta montos que llegan como texto con formato local', () => {
    const body = JSON.stringify({
      data: {
        movimientos: [{ fechaTransaccion: '2026-08-21', descripcion: 'X', valor: '-12.500,00' }],
      },
    });
    const tx = mustExist(extractor(capture(body))[0]);
    expect(tx.monto).toBe(12500);
    expect(tx.tipo).toBe('debito');
  });

  it('devuelve vacío si la ruta de la lista no existe', () => {
    expect(extractor(capture(JSON.stringify({ otra: {} })))).toEqual([]);
  });

  it('devuelve vacío ante un cuerpo que no es JSON', () => {
    expect(extractor(capture('<html></html>'))).toEqual([]);
  });

  it('devuelve vacío si la ruta apunta a algo que no es lista', () => {
    expect(extractor(capture(JSON.stringify({ data: { movimientos: 'texto' } })))).toEqual([]);
  });

  it('descarta los registros que no cumplen el modelo y conserva los válidos', () => {
    const body = JSON.stringify({
      data: {
        movimientos: [
          { fechaTransaccion: '2026-08-20', descripcion: 'BUENA', valor: -1000 },
          { descripcion: 'SIN FECHA', valor: -2000 },
          { fechaTransaccion: '2026-08-22', descripcion: 'SIN MONTO' },
        ],
      },
    });
    const resultado = extractor(capture(body));
    expect(resultado).toHaveLength(1);
    expect(mustExist(resultado[0]).descripcion).toBe('BUENA');
  });
});

describe('createExtractor — por campo de tipo', () => {
  const extractor = createExtractor('nequi', {
    listPath: '',
    fecha: 'date',
    descripcion: 'title',
    monto: 'amount',
    tipo: { path: 'movementType', debito: 'DEBIT' },
  });

  it('usa el campo declarado en vez del signo', () => {
    const body = JSON.stringify([
      { date: '2026-08-22', title: 'ENVIO', amount: 5000, movementType: 'DEBIT' },
      { date: '2026-08-23', title: 'RECARGA', amount: 9000, movementType: 'CREDIT' },
    ]);
    const resultado = extractor(capture(body));
    expect(resultado.map((tx) => tx.tipo)).toEqual(['debito', 'credito']);
    expect(resultado.map((tx) => tx.monto)).toEqual([5000, 9000]);
  });

  it('acepta una lista en la raíz del cuerpo', () => {
    const body = JSON.stringify([
      { date: '2026-08-22', title: 'ENVIO', amount: 5000, movementType: 'DEBIT' },
    ]);
    expect(mustExist(extractor(capture(body))[0]).fuente).toBe('nequi');
  });
});
