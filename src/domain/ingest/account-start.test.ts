import type { IngestRun } from './ingest-run';
import { isBeforeStart, startDayOf } from './account-start';

const corrida = (iniciadoEn: string): IngestRun => ({
  id: 'r1',
  owner: 'david' as IngestRun['owner'],
  fuente: 'bancolombia',
  iniciadoEn,
  terminadoEn: null,
  capturas: 0,
  extraidas: 0,
  nuevas: 0,
  duplicadas: 0,
  fusionadas: 0,
  omitidas: 0,
  anteriores: 0,
  transferencias: 0,
  error: null,
});

describe('startDayOf', () => {
  it('sin corridas previas, el inicio es hoy (día de Colombia)', () => {
    // Las 23:30 UTC del 28 son las 18:30 del 28 en Colombia.
    expect(startDayOf(null, '2026-08-28T23:30:00.000Z')).toBe('2026-08-28');
    // Las 03:00 UTC del 29 siguen siendo el 28 en Colombia.
    expect(startDayOf(null, '2026-08-29T03:00:00.000Z')).toBe('2026-08-28');
  });

  it('con una primera corrida, el inicio es su día, aunque hoy sea otro', () => {
    expect(startDayOf(corrida('2026-08-28T15:00:00.000-05:00'), '2026-09-15T10:00:00.000Z')).toBe(
      '2026-08-28',
    );
  });
});

describe('isBeforeStart', () => {
  it('lo anterior al día de inicio no cuenta; el día de inicio y lo posterior sí', () => {
    expect(isBeforeStart('2026-08-27T00:00:00.000-05:00', '2026-08-28')).toBe(true);
    expect(isBeforeStart('2026-08-28T00:00:00.000-05:00', '2026-08-28')).toBe(false);
    expect(isBeforeStart('2026-08-29T00:00:00.000-05:00', '2026-08-28')).toBe(false);
  });

  it('compara por día de Colombia, no por instante UTC', () => {
    // Medianoche del 28 en Colombia es 05:00 UTC del 28: sigue siendo el 28.
    expect(isBeforeStart('2026-08-28T05:00:00.000Z', '2026-08-28')).toBe(false);
  });

  it('entiende la fecha cruda del portal (AAAA/MM/DD) como día de Colombia', () => {
    expect(isBeforeStart('2026/08/27', '2026-08-28')).toBe(true);
    expect(isBeforeStart('2026/08/28', '2026-08-28')).toBe(false);
  });

  it('la suite corre en UTC, como CI (jest.global-setup.js)', () => {
    expect(new Date('2026-08-28T00:00:00').getTimezoneOffset()).toBe(0);
  });

  it('no depende de la zona horaria de la máquina: en UTC el 28 sigue siendo el 28', () => {
    // CI corre en UTC; la sesión de David, en -05. La regla tiene que dar lo
    // mismo en las dos.
    const original = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      expect(isBeforeStart('2026/08/28', '2026-08-28')).toBe(false);
      expect(isBeforeStart('2026/08/27', '2026-08-28')).toBe(true);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('una fecha ilegible no es anterior: la conversión al ledger la reporta', () => {
    expect(isBeforeStart('2026/02/30', '2026-08-28')).toBe(false);
    expect(isBeforeStart('ayer', '2026-08-28')).toBe(false);
  });
});
