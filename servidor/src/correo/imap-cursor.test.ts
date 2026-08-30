import { describe, expect, it } from 'vitest';

import { formatearCursorImap, parsearCursorImap, rangoDesde } from './imap-cursor';

describe('cursor de IMAP', () => {
  it('va y vuelve', () => {
    expect(parsearCursorImap(formatearCursorImap({ uidValidity: 12, ultimoUid: 4471 }))).toEqual({
      uidValidity: 12,
      ultimoUid: 4471,
    });
  });

  it('sin cursor, o con uno ilegible, no se inventa nada', () => {
    expect(parsearCursorImap(null)).toBeNull();
    expect(parsearCursorImap('')).toBeNull();
    expect(parsearCursorImap('doce:mil')).toBeNull();
    expect(parsearCursorImap('12')).toBeNull();
  });

  it('sin cursor pide desde el principio', () => {
    expect(rangoDesde(null, 12)).toBe('1:*');
  });

  it('con cursor pide solo lo posterior', () => {
    expect(rangoDesde({ uidValidity: 12, ultimoUid: 4471 }, 12)).toBe('4472:*');
  });

  it('si el buzón cambió de UIDVALIDITY, los UID viejos ya no significan nada', () => {
    // Es la trampa clásica de IMAP: el servidor puede reasignar los UID. Con
    // el cursor viejo se saltarían correos o se bajarían los equivocados.
    expect(rangoDesde({ uidValidity: 12, ultimoUid: 4471 }, 13)).toBe('1:*');
  });
});
