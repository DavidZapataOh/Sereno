import { array, assert, property, string } from 'fast-check';

import { accountId, type AccountId } from '@/domain/ledger/ids';

import {
  CONFIDENCE_THRESHOLD,
  featuresOf,
  MIN_MERCHANT_EVIDENCE,
  predict,
  shouldApply,
  type Evidence,
} from './naive-bayes';
import { categoryAccountId } from './taxonomy';

const mercado = categoryAccountId('mercado');
const hogar = categoryAccountId('hogar');

describe('featuresOf', () => {
  it('comercio y palabras; la sucursal no es rasgo', () => {
    expect(featuresOf({ comercio: 'exito', descripcion: 'exito sur' })).toEqual([
      'comercio:exito',
      'palabra:exito',
    ]);
  });
});

const evidencia = (feature: string, categoria: string, cuenta: number): Evidence => ({
  feature,
  categoria: accountId(categoria),
  cuenta,
});

/** Los totales del modelo entero, calculados de las mismas evidencias (aquí el modelo es todo). */
const modeloDe = (evidencias: readonly Evidence[]) => {
  const totales = new Map<AccountId, number>();
  const vocabulario = new Set<string>();
  for (const e of evidencias) {
    if (e.cuenta <= 0) continue;
    totales.set(e.categoria, (totales.get(e.categoria) ?? 0) + e.cuenta);
    vocabulario.add(e.feature);
  }
  return { totales, vocabulario: vocabulario.size };
};
const predecir = (evidencias: readonly Evidence[], features: readonly string[]) =>
  predict(evidencias, features, modeloDe(evidencias));

describe('predict', () => {
  it('sin evidencias no predice', () => {
    expect(predecir([], ['comercio:exito'])).toBeNull();
    expect(predecir([evidencia('comercio:exito', mercado, 0)], ['comercio:exito'])).toBeNull();
  });

  it('elige la categoría con más evidencia para esos rasgos y da confianza alta', () => {
    const evidencias = [
      evidencia('comercio:exito', mercado, 5),
      evidencia('palabra:exito', mercado, 5),
      evidencia('comercio:homecenter', hogar, 3),
      evidencia('palabra:homecenter', hogar, 3),
    ];
    const p = predecir(evidencias, ['comercio:exito', 'palabra:exito']);
    expect(p?.categoria).toBe(mercado);
    expect(p?.confianza).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    expect(p?.evidenciaComercio).toBe(5);
  });

  it('un comercio nunca visto, con palabras repartidas, da confianza baja', () => {
    const evidencias = [
      evidencia('palabra:tienda', mercado, 2),
      evidencia('palabra:tienda', hogar, 2),
    ];
    const p = predecir(evidencias, ['comercio:tienda-x', 'palabra:tienda']);
    expect(p).not.toBeNull();
    expect(p?.confianza).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(p?.evidenciaComercio).toBe(0);
  });

  it('el comercio pesa más que una palabra suelta', () => {
    const evidencias = [
      evidencia('comercio:exito', mercado, 2),
      evidencia('palabra:sur', hogar, 2),
    ];
    expect(predecir(evidencias, ['comercio:exito', 'palabra:sur'])?.categoria).toBe(mercado);
  });

  it('propiedad: la confianza está en 0–100 y es entera', () => {
    const rasgo = string({ minLength: 1, maxLength: 6 }).map((s) => `palabra:${s}`);
    assert(
      property(
        array(rasgo, { minLength: 1, maxLength: 8 }),
        array(rasgo, { minLength: 1, maxLength: 4 }),
        (vistos, consulta) => {
          const evidencias = vistos.map((f, i) =>
            evidencia(f, i % 2 === 0 ? mercado : hogar, 1 + (i % 3)),
          );
          const p = predecir(evidencias, consulta);
          return (
            p === null || (Number.isInteger(p.confianza) && p.confianza >= 0 && p.confianza <= 100)
          );
        },
      ),
    );
  });
});

describe('shouldApply', () => {
  it('exige confianza y evidencia mínima del comercio', () => {
    const base = { categoria: mercado, confianza: 90, evidenciaComercio: MIN_MERCHANT_EVIDENCE };
    expect(shouldApply(base)).toBe(true);
    expect(shouldApply({ ...base, evidenciaComercio: 1 })).toBe(false);
    expect(shouldApply({ ...base, confianza: 59, evidenciaComercio: 5 })).toBe(false);
  });
});
