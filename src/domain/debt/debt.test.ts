import { accountId, ownerId } from '@/domain/ledger/ids';

import { createDebt, TASA_MAXIMA, type Debt } from './debt';

const base: Debt = {
  accountId: accountId('prestamo:banco'),
  owner: ownerId('david'),
  tipo: 'prestamo',
  nombre: 'Crédito de libre inversión',
  tasa: { valor: 0.24, tipo: 'EA' },
  cuotasTotales: 36,
  diaDePago: 15,
};

describe('createDebt', () => {
  it('acepta un préstamo con tasa y plazo', () => {
    expect(createDebt(base)).toEqual(base);
  });

  /**
   * Lo que se le debe a un primo no tiene tasa, y ponerle cero **no es lo
   * mismo**: cero diría «no cobra intereses» y `null` dice «no aplica». La
   * simulación las ordena distinto.
   */
  it('acepta una deuda con una persona sin tasa ni plazo', () => {
    expect(() =>
      createDebt({ ...base, tipo: 'persona', tasa: null, cuotasTotales: null, diaDePago: null }),
    ).not.toThrow();
  });

  it('una tarjeta es un tipo de deuda, no una cosa aparte', () => {
    expect(() => createDebt({ ...base, tipo: 'tarjeta' })).not.toThrow();
  });

  it('rechaza una tasa negativa', () => {
    expect(() => createDebt({ ...base, tasa: { valor: -0.01, tipo: 'EA' } })).toThrow(/negativa/i);
  });

  /**
   * Un 500 % E.A. no es una deuda: es un dato mal metido, y dejarlo pasar haría
   * que la simulación diera una fecha de salida absurda con toda seriedad.
   */
  it('rechaza una tasa absurda', () => {
    expect(() => createDebt({ ...base, tasa: { valor: 5, tipo: 'EA' } })).toThrow(/alta/i);
    expect(TASA_MAXIMA).toBeLessThan(2);
  });

  it('acepta una tasa cero pactada, que no es lo mismo que no tener tasa', () => {
    const sinInteres = createDebt({ ...base, tasa: { valor: 0, tipo: 'EA' } });

    expect(sinInteres.tasa).not.toBeNull();
    expect(sinInteres.tasa?.valor).toBe(0);
  });

  it('rechaza un plazo que no es un entero positivo', () => {
    expect(() => createDebt({ ...base, cuotasTotales: 0 })).toThrow(/plazo/i);
    expect(() => createDebt({ ...base, cuotasTotales: 1.5 })).toThrow(/plazo/i);
    expect(() => createDebt({ ...base, cuotasTotales: -3 })).toThrow(/plazo/i);
  });

  /** Misma regla que las tarjetas del sprint 07: 29, 30 y 31 no valen. */
  it('rechaza un día de pago que no existe en todos los meses', () => {
    expect(() => createDebt({ ...base, diaDePago: 31 })).toThrow(/entre 1 y 28/);
  });

  it('el nombre no puede estar vacío: una lista de deudas sin nombre no se lee', () => {
    expect(() => createDebt({ ...base, nombre: '   ' })).toThrow(/nombre/i);
  });

  it('recorta el nombre', () => {
    expect(createDebt({ ...base, nombre: '  Nu  ' }).nombre).toBe('Nu');
  });
});
