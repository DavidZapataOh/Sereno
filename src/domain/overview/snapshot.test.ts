import { ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import { hayHueco, snapshot, type Snapshot } from './snapshot';

const owner = ownerId('david');

const base: Snapshot = {
  owner,
  dia: '2026-08-31',
  patrimonio: money(1_814_013n, 'COP'),
  tasas: 'TRM oficial × Binance',
  tomadaEn: '2026-08-31T10:00:00.000-05:00',
};

describe('snapshot', () => {
  it('acepta una instantánea corriente', () => {
    expect(snapshot(base)).toEqual(base);
  });

  it('acepta un patrimonio negativo: deber más de lo que se tiene es posible', () => {
    expect(() => snapshot({ ...base, patrimonio: money(-300_000n, 'COP') })).not.toThrow();
  });

  it('rechaza un día que no es YYYY-MM-DD', () => {
    expect(() => snapshot({ ...base, dia: '31/08/2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => snapshot({ ...base, dia: '2026-08-31T10:00' })).toThrow();
  });

  /** La serie compara días entre sí: en dos monedas no se puede comparar. */
  it('rechaza una serie que no vaya en pesos', () => {
    expect(() => snapshot({ ...base, patrimonio: money(1n, 'USDC') })).toThrow(/pesos/);
  });
});

describe('hayHueco', () => {
  const de = (dia: string): Snapshot => ({ ...base, dia });

  it('dos días seguidos no dejan hueco', () => {
    expect(hayHueco(de('2026-08-30'), de('2026-08-31'))).toBe(false);
  });

  /**
   * Un día sin instantánea no es un cero: un cero en la gráfica se lee como
   * «se quedó sin nada», y lo que pasó es que la app no se abrió.
   */
  it('un día saltado sí', () => {
    expect(hayHueco(de('2026-08-29'), de('2026-08-31'))).toBe(true);
  });

  it('lo detecta cruzando el fin de mes', () => {
    expect(hayHueco(de('2026-08-31'), de('2026-09-01'))).toBe(false);
    expect(hayHueco(de('2026-08-30'), de('2026-09-01'))).toBe(true);
  });

  it('lo detecta cruzando el fin de año', () => {
    expect(hayHueco(de('2026-12-31'), de('2027-01-01'))).toBe(false);
  });
});
