import { formatLongDate, formatRelative, formatShortDate } from './format';

describe('formatShortDate', () => {
  it('día y mes abreviado en español, en hora de Colombia', () => {
    expect(formatShortDate('2026-08-28T00:00:00.000-05:00')).toBe('28 ago');
    expect(formatShortDate('2026-01-05T10:00:00.000-05:00')).toBe('5 ene');
  });

  it('un instante UTC de madrugada es el día anterior en Colombia', () => {
    expect(formatShortDate('2026-08-29T03:00:00.000Z')).toBe('28 ago');
  });
});

describe('formatLongDate', () => {
  it('fecha completa', () => {
    expect(formatLongDate('2026-08-28T00:00:00.000-05:00')).toBe('28 de agosto de 2026');
  });
});

describe('formatRelative', () => {
  const ahora = '2026-08-28T12:00:00.000-05:00';

  it.each([
    ['2026-08-28T11:59:30.000-05:00', 'justo ahora'],
    ['2026-08-28T11:55:00.000-05:00', 'hace 5 min'],
    ['2026-08-28T09:00:00.000-05:00', 'hace 3 h'],
    ['2026-08-27T12:00:00.000-05:00', 'hace 1 día'],
    ['2026-08-26T12:00:00.000-05:00', 'hace 2 días'],
    ['2026-08-10T12:00:00.000-05:00', '10 ago'],
  ])('%s → %s', (iso, esperado) => {
    expect(formatRelative(iso, ahora)).toBe(esperado);
  });

  it('un instante futuro se trata como ahora, no como negativo', () => {
    expect(formatRelative('2026-08-28T12:05:00.000-05:00', ahora)).toBe('justo ahora');
  });
});
