import { extraerBancolombia } from './portals-field-maps';
import type { Capture } from './reassembler';
import { exigir } from '@/test/exigir';

function capture(body: unknown): Capture {
  return {
    id: 'muestra',
    url: 'https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ch-ms-deposits/account/transactions',
    method: 'POST',
    status: 200,
    contentType: 'application/json',
    kind: 'fetch',
    capturedAt: '2026-08-29T15:00:00.000Z',
    body: JSON.stringify(body),
  };
}

/**
 * Estructura real capturada en campo el 2026-08-29, con TODOS los valores
 * alterados: montos inventados, comercios genéricos y fechas movidas.
 *
 * Se conserva la forma —nombres de campo, anidamiento, tipos y la nomenclatura
 * invertida de `type`— para que cualquier cambio futuro en el extractor se
 * pruebe contra la realidad y no contra una suposición.
 */
const MUESTRA_BANCOLOMBIA = {
  meta: {
    messageId: 'muestra',
    applicationId: null,
    requestDateTime: '2026-08-29T15:00:00',
    responseSize: 4,
    flagMoreRecords: null,
    pages: 1,
  },
  data: {
    account: {
      allow: null,
      balances: null,
      currency: null,
      customer: null,
      jointHolder: false,
      type: 'AHORROS',
      number: '00000000000',
      bankId: null,
      name: null,
      novelty: null,
      plan: null,
      group: null,
      specifications: null,
      office: null,
      regime: null,
      participantRelation: null,
      status: null,
    },
    transactions: [
      {
        valueDate: null,
        transactionDate: '2026/08/28',
        trackingId: null,
        id: null,
        description: 'COMPRA COMERCIO GENERICO',
        amount: -45000.0,
        type: 'CREDITO',
        reference1: '000000000000000000000000001',
        reference2: null,
        reference3: null,
        checkNumber: null,
        office: { code: null, name: 'OFICINA' },
        relatedTransferAccount: null,
      },
      {
        valueDate: null,
        transactionDate: '2026/08/27',
        trackingId: null,
        id: null,
        description: 'ABONO GENERICO',
        amount: 1000000.0,
        type: 'DEBITO',
        reference1: '000000000000000000000000002',
        reference2: null,
        reference3: null,
        checkNumber: null,
        office: { code: null, name: 'OFICINA' },
        relatedTransferAccount: null,
      },
      {
        valueDate: null,
        transactionDate: '2026/08/26',
        trackingId: null,
        id: null,
        description: 'RETIRO GENERICO',
        amount: -20000.5,
        type: 'CREDITO',
        reference1: '000000000000000000000000003',
        reference2: null,
        reference3: null,
        checkNumber: null,
        office: { code: null, name: 'OFICINA' },
        relatedTransferAccount: null,
      },
    ],
  },
};

describe('extractor de Bancolombia', () => {
  it('extrae todas las transacciones de la muestra', () => {
    expect(extraerBancolombia(capture(MUESTRA_BANCOLOMBIA))).toHaveLength(3);
  });

  it('su CREDITO es nuestro débito: las compras son dinero que sale', () => {
    const compra = exigir(extraerBancolombia(capture(MUESTRA_BANCOLOMBIA))[0]);
    expect(compra.descripcion).toBe('COMPRA COMERCIO GENERICO');
    expect(compra.tipo).toBe('debito');
  });

  it('su DEBITO es nuestro crédito: los abonos son dinero que entra', () => {
    const abono = exigir(extraerBancolombia(capture(MUESTRA_BANCOLOMBIA))[1]);
    expect(abono.descripcion).toBe('ABONO GENERICO');
    expect(abono.tipo).toBe('credito');
  });

  it('el monto es siempre positivo, con el signo en el tipo', () => {
    extraerBancolombia(capture(MUESTRA_BANCOLOMBIA)).forEach((tx) => {
      expect(tx.monto).toBeGreaterThanOrEqual(0);
    });
  });

  it('trunca los decimales que trae el portal', () => {
    const retiro = exigir(extraerBancolombia(capture(MUESTRA_BANCOLOMBIA))[2]);
    expect(retiro.monto).toBe(20000);
  });

  it('conserva la referencia', () => {
    const primera = exigir(extraerBancolombia(capture(MUESTRA_BANCOLOMBIA))[0]);
    expect(primera.referencia).toBe('000000000000000000000000001');
  });

  it('conserva la fecha en el formato del portal', () => {
    // Bancolombia entrega AAAA/MM/DD, no ISO 8601. La conversión ocurre al
    // llevarlo al ledger, no aquí.
    const primera = exigir(extraerBancolombia(capture(MUESTRA_BANCOLOMBIA))[0]);
    expect(primera.fecha).toBe('2026/08/28');
  });
});
