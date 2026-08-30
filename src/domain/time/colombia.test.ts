import { assert, integer, property, tuple } from 'fast-check';

import { calendarDay, COLOMBIA_UTC_OFFSET, daysBetween, parsePortalDate } from './colombia';

describe('parsePortalDate', () => {
  it('convierte AAAA/MM/DD a ISO con la zona de Colombia', () => {
    expect(parsePortalDate('2026/08/28')).toBe('2026-08-28T00:00:00.000-05:00');
  });

  it('la zona es siempre la de Colombia, que no tiene horario de verano', () => {
    expect(COLOMBIA_UTC_OFFSET).toBe('-05:00');
    expect(parsePortalDate('2026/01/15')).toContain('-05:00');
    expect(parsePortalDate('2026/07/15')).toContain('-05:00');
  });

  it('rechaza un formato que no sea AAAA/MM/DD', () => {
    expect(() => parsePortalDate('28/08/2026')).toThrow(/AAAA\/MM\/DD/);
    expect(() => parsePortalDate('2026-08-28')).toThrow(/AAAA\/MM\/DD/);
    expect(() => parsePortalDate('')).toThrow(/AAAA\/MM\/DD/);
  });

  it('rechaza una fecha que no existe en vez de desbordarla al mes siguiente', () => {
    // `new Date('2026-02-30')` devolvería el 2 de marzo sin protestar.
    expect(() => parsePortalDate('2026/02/30')).toThrow(/no existe/);
    expect(() => parsePortalDate('2026/13/01')).toThrow(/no existe/);
  });

  it('acepta el 29 de febrero solo en año bisiesto', () => {
    expect(parsePortalDate('2028/02/29')).toBe('2028-02-29T00:00:00.000-05:00');
    expect(() => parsePortalDate('2026/02/29')).toThrow(/no existe/);
  });
});

describe('calendarDay', () => {
  it('devuelve el día en Colombia de un instante con zona', () => {
    expect(calendarDay('2026-08-28T00:00:00.000-05:00')).toBe('2026-08-28');
  });

  it('un instante UTC de madrugada sigue siendo el día anterior en Colombia', () => {
    // 03:00 UTC del 29 son las 22:00 del 28 en Bogotá.
    expect(calendarDay('2026-08-29T03:00:00.000Z')).toBe('2026-08-28');
  });

  it('lanza ante una fecha inválida en vez de devolver "NaN-NaN-NaN"', () => {
    expect(() => calendarDay('no es fecha')).toThrow(/inválida/);
  });
});

describe('daysBetween', () => {
  it('es cero para el mismo día', () => {
    expect(daysBetween('2026-08-28T08:00:00.000-05:00', '2026-08-28T20:00:00.000-05:00')).toBe(0);
  });

  it('cuenta días calendario, no bloques de 24 horas', () => {
    // 23:00 del 28 y 01:00 del 29: dos horas de diferencia, pero días distintos.
    expect(daysBetween('2026-08-28T23:00:00.000-05:00', '2026-08-29T01:00:00.000-05:00')).toBe(1);
  });

  it('es simétrica y cuenta exacto sobre cualquier par de días', () => {
    assert(
      property(tuple(integer({ min: 0, max: 3650 }), integer({ min: 0, max: 3650 })), ([a, b]) => {
        const base = Date.UTC(2020, 0, 1, 12);
        const fa = new Date(base + a * 86_400_000).toISOString();
        const fb = new Date(base + b * 86_400_000).toISOString();
        expect(daysBetween(fa, fb)).toBe(daysBetween(fb, fa));
        expect(daysBetween(fa, fb)).toBe(Math.abs(a - b));
      }),
    );
  });
});
