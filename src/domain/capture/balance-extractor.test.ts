import { balanceExtractorFor } from './extractors';
import { extractBancolombiaBalances } from './portals-field-maps';
import type { Capture } from './reassembler';

const URL_SALDOS =
  'https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ch-ms-deposits/hybrid/accounts/customization/consolidated';

/** Forma real del endpoint consolidado, según los hallazgos del sprint 01. */
const capture = (body: unknown, url = URL_SALDOS): Capture => ({
  id: 'c1',
  url,
  method: 'GET',
  status: 200,
  contentType: 'application/json',
  kind: 'fetch',
  capturedAt: '2026-08-28T10:00:00.000-05:00',
  body: JSON.stringify(body),
});

const consolidado = {
  data: {
    accounts: [
      {
        number: '12345678901',
        name: 'Ahorros',
        type: 'CUENTA_AHORRO',
        currency: 'COP',
        status: 'ACTIVA',
        balances: { available: 1523400.5, current: 1523400.5, effective: 1500000 },
      },
      {
        number: '99999999999',
        name: 'Corriente',
        type: 'CUENTA_CORRIENTE',
        currency: 'COP',
        status: 'ACTIVA',
        balances: { available: 0, current: 0, effective: 0 },
      },
    ],
  },
};

describe('extractBancolombiaBalances', () => {
  it('extrae una cuenta por elemento con su saldo disponible', () => {
    const saldos = extractBancolombiaBalances(capture(consolidado));
    expect(saldos).toHaveLength(2);
    expect(saldos[0]).toEqual({
      fuente: 'bancolombia',
      numero: '12345678901',
      nombre: 'Ahorros',
      moneda: 'COP',
      saldo: 1523400,
    });
  });

  it('trunca los decimales que el portal trae: el peso no los usa', () => {
    expect(extractBancolombiaBalances(capture(consolidado))[0]?.saldo).toBe(1523400);
  });

  it('acepta saldo cero', () => {
    expect(extractBancolombiaBalances(capture(consolidado))[1]?.saldo).toBe(0);
  });

  it('descarta un elemento sin saldo legible en vez de inventar cero', () => {
    const roto = {
      data: { accounts: [{ number: '1', name: 'X', currency: 'COP', balances: {} }] },
    };
    expect(extractBancolombiaBalances(capture(roto))).toEqual([]);
  });

  it('devuelve vacío ante un cuerpo que no es JSON o no tiene la lista', () => {
    expect(extractBancolombiaBalances({ ...capture({}), body: 'no json' })).toEqual([]);
    expect(extractBancolombiaBalances(capture({ data: {} }))).toEqual([]);
  });
});

describe('balanceExtractorFor', () => {
  it('solo extrae de la URL del endpoint de saldos', () => {
    const extraer = balanceExtractorFor('bancolombia');
    expect(extraer).not.toBeNull();
    expect(extraer?.(capture(consolidado, 'https://www.bancolombia.com/otra'))).toEqual([]);
    expect(extraer?.(capture(consolidado))).toHaveLength(2);
  });

  it('es null para un portal sin saldo por web', () => {
    expect(balanceExtractorFor('nequi')).toBeNull();
  });
});
