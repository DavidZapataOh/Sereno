import { array, assert, integer, property, record, string } from 'fast-check';

import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { ownerId, transactionId } from '@/domain/ledger/ids';

import {
  assignDerivedReferences,
  candidateFingerprints,
  chooseDuplicate,
  type MatchContext,
} from './duplicates';
import { fingerprintOf } from './fingerprint';
import type { Observation } from './observation';

const owner = ownerId('david');

const web: NormalizedTransaction = {
  fecha: '2026/08/28',
  descripcion: 'COMPRA PSE *4471 EXITO SUR',
  monto: 45000,
  moneda: 'COP',
  tipo: 'debito',
  fuente: 'bancolombia',
  referencia: 'REF-1',
};

/** La misma compra vista por correo: otra fuente, otro texto, un día antes, sin referencia. */
const correo: NormalizedTransaction = {
  ...web,
  fecha: '2026/08/27',
  descripcion: 'Pago en EXITO SUR',
  fuente: 'nequi',
  referencia: null,
};

const observacion = (
  n: NormalizedTransaction,
  tx: string,
  extra: Partial<Observation> = {},
): Observation => ({
  id: `${tx}@${n.fuente}`,
  transactionId: transactionId(tx),
  owner,
  fuente: n.fuente,
  referencia: n.referencia,
  huella: fingerprintOf(n),
  capturadoEn: '2026-08-28T10:00:00.000-05:00',
  runId: null,
  crudo: n,
  ...extra,
});

describe('candidateFingerprints', () => {
  it('genera la huella del día y las de un día a cada lado', () => {
    expect(candidateFingerprints(web)).toEqual([
      '2026-08-27|45000|exito sur',
      '2026-08-28|45000|exito sur',
      '2026-08-29|45000|exito sur',
    ]);
  });

  it('con tolerancia cero solo genera la del día', () => {
    expect(candidateFingerprints(web, 0)).toEqual(['2026-08-28|45000|exito sur']);
  });

  it('cruza el cambio de mes sin inventar fechas', () => {
    const finDeMes = { ...web, fecha: '2026/08/31' };
    expect(candidateFingerprints(finDeMes).map((h) => h.slice(0, 10))).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
  });
});

describe('assignDerivedReferences', () => {
  it('respeta las referencias que ya vienen', () => {
    expect(assignDerivedReferences([web])[0]?.referencia).toBe('REF-1');
  });

  it('deriva la referencia de la huella cuando falta', () => {
    expect(assignDerivedReferences([correo])[0]?.referencia).toBe('h:2026-08-27|45000|exito sur#1');
  });

  it('dos idénticas sin referencia en el mismo lote reciben ordinales distintos', () => {
    // Dos almuerzos iguales el mismo día son dos almuerzos, no uno.
    const [a, b] = assignDerivedReferences([correo, { ...correo }]);
    expect(a?.referencia).toBe('h:2026-08-27|45000|exito sur#1');
    expect(b?.referencia).toBe('h:2026-08-27|45000|exito sur#2');
  });

  it('es determinista: el mismo lote produce las mismas referencias', () => {
    const lote = [correo, { ...correo }, { ...correo, monto: 1 }];
    expect(assignDerivedReferences(lote)).toEqual(assignDerivedReferences(lote));
  });

  it('no muta la entrada', () => {
    const copia = { ...correo };
    assignDerivedReferences([copia]);
    expect(copia.referencia).toBeNull();
  });
});

describe('chooseDuplicate', () => {
  const contexto = (n: NormalizedTransaction, tx: string, fuentes: string[]): MatchContext => ({
    observation: observacion(n, tx),
    fuentesQueLaVieron: fuentes,
  });

  it('empareja con una observación de otra fuente y huella compatible', () => {
    const elegida = chooseDuplicate(correo, [contexto(web, 'bancolombia:REF-1', ['bancolombia'])]);
    expect(elegida?.transactionId).toBe('bancolombia:REF-1');
  });

  it('nunca empareja con la misma fuente: ahí la identidad es la referencia', () => {
    const otraCompraIgual = { ...web, referencia: 'REF-2' };
    expect(
      chooseDuplicate(otraCompraIgual, [contexto(web, 'bancolombia:REF-1', ['bancolombia'])]),
    ).toBeNull();
  });

  it('no empareja con una transacción que esta fuente ya vio', () => {
    // Uno a uno por fuente: si el correo ya aportó su observación a esa
    // transacción, un segundo correo igual es OTRA compra.
    const ctx = contexto(web, 'bancolombia:REF-1', ['bancolombia', 'nequi']);
    expect(chooseDuplicate(correo, [ctx])).toBeNull();
  });

  it('con varias candidatas elige la del día más cercano', () => {
    const lejana = contexto(
      { ...web, fecha: '2026/08/29', referencia: 'REF-L' },
      'bancolombia:REF-L',
      ['bancolombia'],
    );
    const cercana = contexto(
      { ...web, fecha: '2026/08/27', referencia: 'REF-C' },
      'bancolombia:REF-C',
      ['bancolombia'],
    );
    expect(chooseDuplicate(correo, [lejana, cercana])?.transactionId).toBe('bancolombia:REF-C');
  });

  it('a igual distancia, elige la observada primero', () => {
    const tarde = contexto({ ...web, referencia: 'REF-T' }, 'bancolombia:REF-T', ['bancolombia']);
    tarde.observation = { ...tarde.observation, capturadoEn: '2026-08-28T12:00:00.000-05:00' };
    const temprano = contexto({ ...web, referencia: 'REF-E' }, 'bancolombia:REF-E', [
      'bancolombia',
    ]);
    temprano.observation = {
      ...temprano.observation,
      capturadoEn: '2026-08-28T08:00:00.000-05:00',
    };
    expect(chooseDuplicate(correo, [tarde, temprano])?.transactionId).toBe('bancolombia:REF-E');
  });

  it('sin candidatas devuelve null', () => {
    expect(chooseDuplicate(correo, [])).toBeNull();
  });

  it('propiedad: nunca elige una observación de la misma fuente', () => {
    const arb = record({
      monto: integer({ min: 1, max: 100 }),
      dia: integer({ min: 1, max: 28 }),
      desc: string({ minLength: 1, maxLength: 6 }),
    });
    assert(
      property(array(arb, { maxLength: 10 }), (lote) => {
        const candidato: NormalizedTransaction = { ...web, referencia: 'X' };
        const contextos = lote.map((m, i) =>
          contexto(
            {
              ...web,
              monto: m.monto,
              fecha: `2026/08/${String(m.dia).padStart(2, '0')}`,
              descripcion: m.desc,
              referencia: `R${String(i)}`,
            },
            `bancolombia:R${String(i)}`,
            ['bancolombia'],
          ),
        );
        expect(chooseDuplicate(candidato, contextos)).toBeNull();
      }),
    );
  });
});
