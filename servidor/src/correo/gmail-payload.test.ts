import { describe, expect, it } from 'vitest';

import { cabecera, parteDeTexto } from './gmail-payload';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

/** La forma que devuelve `users.messages.get` con `format: 'full'`. */
const payload = {
  mimeType: 'multipart/alternative',
  headers: [
    { name: 'From', value: 'Alertas <alertasynotificaciones@an.notificacionesbancolombia.com>' },
    { name: 'Subject', value: 'Alertas y Notificaciones' },
    { name: 'Date', value: 'Fri, 28 Aug 2026 18:05:57 +0000' },
  ],
  parts: [
    { mimeType: 'text/plain', body: { data: b64('Compraste $10.700,00 en COMERCIO DE PRUEBA') } },
    { mimeType: 'text/html', body: { data: b64('<p>Compraste $10.700,00</p>') } },
  ],
};

describe('payload de Gmail', () => {
  it('saca texto y HTML de las partes, decodificados', () => {
    expect(parteDeTexto(payload)).toEqual({
      texto: 'Compraste $10.700,00 en COMERCIO DE PRUEBA',
      html: '<p>Compraste $10.700,00</p>',
    });
  });

  it('encuentra las partes aunque estén anidadas', () => {
    const anidado = {
      mimeType: 'multipart/mixed',
      parts: [{ mimeType: 'multipart/alternative', parts: payload.parts }],
    };
    expect(parteDeTexto(anidado).texto).toContain('COMERCIO DE PRUEBA');
  });

  it('un correo sin texto plano devuelve el HTML y texto vacío, sin reventar', () => {
    const soloHtml = { mimeType: 'text/html', body: { data: b64('<p>hola</p>') } };
    expect(parteDeTexto(soloHtml)).toEqual({ texto: '', html: '<p>hola</p>' });
  });

  it('un payload vacío no revienta', () => {
    expect(parteDeTexto({})).toEqual({ texto: '', html: null });
  });

  it('las cabeceras se buscan sin distinguir mayúsculas', () => {
    expect(cabecera(payload, 'subject')).toBe('Alertas y Notificaciones');
    expect(cabecera(payload, 'no-existe')).toBe('');
  });
});
