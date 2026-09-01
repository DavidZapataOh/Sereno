import { transactionId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { assert, integer, property } from 'fast-check';

import { anomalyId, createAnomaly, type Anomaly } from './anomaly';
import { COBROS_MINIMOS, medianaDe, montoInusual, VECES_PARA_SER_RARO } from './unusual-amount';

const COP = 'COP' as const;
const tx = transactionId('manual:1');

const base: Anomaly = {
  id: 'monto-inusual:manual:1',
  tipo: 'monto-inusual',
  transaccion: tx,
  explicacion: 'Este cobro es 4,2 veces lo que sueles gastar aquí',
  comparadoCon: 'la mediana de 12 cobros de la misma categoría',
  confianza: 0.6,
};

describe('createAnomaly', () => {
  /** Una alerta sin explicación es ruido, y el ruido apaga las buenas. */
  it('una anomalía sin explicación no se puede construir', () => {
    expect(() => createAnomaly({ ...base, explicacion: '  ' })).toThrow(/explicación/i);
  });

  /** Una explicación que no dice contra qué se comparó no explica nada. */
  it('una anomalía sin «comparado con» tampoco', () => {
    expect(() => createAnomaly({ ...base, comparadoCon: '' })).toThrow(/comparó/i);
  });

  it('la confianza va de 0 a 1', () => {
    expect(() => createAnomaly({ ...base, confianza: 1.5 })).toThrow(/0 a 1/);
    expect(() => createAnomaly({ ...base, confianza: -0.1 })).toThrow(/0 a 1/);
  });

  /** Si el id cambiara, una anomalía descartada volvería a aparecer. */
  it('el id es estable: dos llamadas dan el mismo', () => {
    expect(anomalyId('monto-inusual', tx)).toBe(anomalyId('monto-inusual', tx));
  });

  it('dos tipos sobre la misma transacción son anomalías distintas', () => {
    expect(anomalyId('monto-inusual', tx)).not.toBe(anomalyId('cobro-repetido', tx));
  });
});

describe('medianaDe', () => {
  it('con impares es el del medio', () => {
    expect(medianaDe([money(10, COP), money(30, COP), money(20, COP)])).toBe(20n);
  });

  it('con pares promedia los dos centrales', () => {
    expect(medianaDe([money(10, COP), money(20, COP), money(30, COP), money(40, COP)])).toBe(25n);
  });

  /**
   * Lo que hace que la mediana sirva y la media no: un valor enorme no la mueve.
   */
  it('una compra enorme no la mueve', () => {
    const normales = [10, 20, 30, 40, 50].map((n) => money(n, COP));
    const conEnorme = [...normales, money(1_000_000, COP)];

    expect(medianaDe(conEnorme)).toBeLessThan(100n);
  });

  it('sin datos es cero', () => {
    expect(medianaDe([])).toBe(0n);
  });
});

describe('montoInusual', () => {
  const historial = (montos: number[]) => montos.map((n) => money(n, COP));
  const cobro = (monto: number) => ({ transaccion: tx, monto: money(monto, COP), comercio: 'x' });
  const NORMALES = historial([50_000, 55_000, 48_000, 52_000, 51_000, 49_000, 53_000]);

  it('un cobro de cuatro veces la mediana se detecta', () => {
    expect(montoInusual(cobro(210_000), NORMALES)).not.toBeNull();
  });

  it('un cobro normal no se detecta', () => {
    expect(montoInusual(cobro(54_000), NORMALES)).toBeNull();
  });

  /**
   * La media se deja arrastrar por una compra grande y a partir de ahí deja de
   * detectar. La mediana no: es la razón de usarla.
   */
  it('una compra enorme del mes pasado no ciega la detección de este mes', () => {
    const conUnaEnorme = [...NORMALES, money(2_000_000, COP)];

    expect(montoInusual(cobro(210_000), conUnaEnorme)).not.toBeNull();
  });

  /** Con tres datos, cualquier cosa parece inusual. */
  it('sin historia suficiente no detecta nada', () => {
    expect(montoInusual(cobro(1_000_000), historial([50_000, 55_000]))).toBeNull();
    expect(COBROS_MINIMOS).toBeGreaterThanOrEqual(6);
  });

  it('la explicación dice cuántas veces por encima, y contra qué', () => {
    const a = montoInusual(cobro(210_000), NORMALES);

    expect(a?.explicacion).toMatch(/veces/);
    expect(a?.comparadoCon).toMatch(/mediana/);
    expect(a?.comparadoCon).toMatch(/\d+/);
  });

  it('cuanto más lejos de la mediana, más confianza, pero nunca certeza', () => {
    const cerca = montoInusual(cobro(210_000), NORMALES);
    const lejos = montoInusual(cobro(2_000_000), NORMALES);

    expect(lejos?.confianza).toBeGreaterThan(cerca?.confianza ?? 0);
    expect(lejos?.confianza).toBeLessThan(1);
  });

  it('propiedad: nunca detecta un cobro por debajo de la mediana', () => {
    assert(
      property(integer({ min: 1, max: 51_000 }), (monto) => {
        return montoInusual(cobro(monto), NORMALES) === null;
      }),
      { numRuns: 500 },
    );
  });

  it('el umbral está declarado y es alto a propósito', () => {
    expect(VECES_PARA_SER_RARO).toBeGreaterThanOrEqual(3);
  });
});
