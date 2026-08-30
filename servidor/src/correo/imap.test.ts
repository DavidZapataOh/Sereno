import { simpleParser } from 'mailparser';
import { describe, expect, it } from 'vitest';

import { mensajeDesde } from './imap';

/** Un correo multiparte como los que manda un banco: texto y HTML. */
const CRUDO = [
  'From: Alertas y Notificaciones <alertasynotificaciones@an.notificacionesbancolombia.com>',
  'To: david@example.com',
  'Subject: =?UTF-8?Q?Alertas_y_Notificaciones?=',
  'Date: Fri, 28 Aug 2026 18:05:57 +0000',
  'Content-Type: multipart/alternative; boundary="frontera"',
  '',
  '--frontera',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Compraste $10.700,00 en COMERCIO DE PRUEBA con tu T.Deb *0000',
  '',
  '--frontera',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>Compraste <b>$10.700,00</b> en COMERCIO DE PRUEBA</p>',
  '',
  '--frontera--',
  '',
].join('\r\n');

describe('mensajeDesde', () => {
  it('convierte un correo MIME real en RawMessage, con el asunto decodificado', async () => {
    const mensaje = mensajeDesde(4472, await simpleParser(CRUDO));

    expect(mensaje.id).toBe('4472');
    expect(mensaje.remitente).toBe('alertasynotificaciones@an.notificacionesbancolombia.com');
    expect(mensaje.asunto).toBe('Alertas y Notificaciones');
    expect(mensaje.recibidoEn).toBe('2026-08-28T18:05:57.000Z');
    expect(mensaje.texto).toContain('COMERCIO DE PRUEBA');
    expect(mensaje.html).toContain('<b>$10.700,00</b>');
  });

  it('un correo solo con HTML deja el texto derivado, no vacío', async () => {
    const soloHtml = [
      'From: nu@nu.com.co',
      'Subject: Compra',
      'Date: Sun, 30 Aug 2026 15:04:05 -0500',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>Tu pago fue de <b>$12.000</b></p>',
      '',
    ].join('\r\n');

    const mensaje = mensajeDesde(1, await simpleParser(soloHtml));
    expect(mensaje.texto).toContain('12.000');
    expect(mensaje.html).not.toBeNull();
  });

  it('un correo sin fecha no se queda sin ella', async () => {
    const sinFecha = ['From: a@nequi.com.co', 'Subject: x', '', 'cuerpo', ''].join('\r\n');
    const mensaje = mensajeDesde(2, await simpleParser(sinFecha));
    expect(Number.isNaN(Date.parse(mensaje.recibidoEn))).toBe(false);
  });
});
