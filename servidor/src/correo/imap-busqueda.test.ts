import { describe, expect, it } from 'vitest';

import { criteriosDe, cursorTras } from './imap-busqueda';

const AHORA = new Date('2026-08-31T00:00:00.000Z');

describe('criteriosDe', () => {
  it('deja el filtro de remitentes en manos del servidor de correo', () => {
    const c = criteriosDe(null, 7, AHORA, 30);
    const dominios = c.or.map((o) => o.from);
    expect(dominios).toContain('notificacionesbancolombia.com');
    expect(dominios).toContain('rappicard.co');
    expect(c.or.length).toBeGreaterThan(4);
  });

  it('la primera pasada se acota por fecha, no se trae el buzón entero', () => {
    const c = criteriosDe(null, 7, AHORA, 30);
    expect(c.uid).toBe('1:*');
    expect(c.since?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('con cursor, va por UID y sin fecha: ya sabe exactamente dónde se quedó', () => {
    const c = criteriosDe({ uidValidity: 7, ultimoUid: 4471 }, 7, AHORA, 30);
    expect(c.uid).toBe('4472:*');
    expect(c.since).toBeUndefined();
  });

  it('si el buzón se reconstruyó, vuelve a acotar por fecha', () => {
    const c = criteriosDe({ uidValidity: 6, ultimoUid: 4471 }, 7, AHORA, 30);
    expect(c.uid).toBe('1:*');
    expect(c.since).toBeDefined();
  });
});

describe('cursorTras', () => {
  it('salta al final del buzón cuando ya se leyó todo lo encontrado', () => {
    const uid = cursorTras({
      encontrados: 3,
      leidos: [10, 20, 30],
      uidNext: 9001,
      anteriorUltimoUid: 0,
    });
    expect(uid).toBe(9000);
  });

  it('no pasa del último leído cuando el lote se cortó por el límite', () => {
    const uid = cursorTras({
      encontrados: 50,
      leidos: [10, 20, 30],
      uidNext: 9001,
      anteriorUltimoUid: 0,
    });
    expect(uid).toBe(30);
  });

  it('sin nada que leer, el cursor no retrocede', () => {
    const uid = cursorTras({ encontrados: 0, leidos: [], uidNext: null, anteriorUltimoUid: 4471 });
    expect(uid).toBe(4471);
  });

  it('sin uidNext se queda en lo leído, que es lo único seguro', () => {
    const uid = cursorTras({
      encontrados: 2,
      leidos: [10, 20],
      uidNext: null,
      anteriorUltimoUid: 0,
    });
    expect(uid).toBe(20);
  });
});
