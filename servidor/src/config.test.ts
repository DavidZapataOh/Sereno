import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { leerConfig } from './config';

const completo = {
  DATABASE_URL: 'postgres://usuario:clave@host:5432/sereno',
  SERENO_TOKEN: 'un-token-suficientemente-largo-para-servir',
  SERENO_CLAVE_CIFRADO: randomBytes(32).toString('base64'),
  IMAP_HOST: 'imap.gmail.com',
  IMAP_USUARIO: 'david@example.com',
  IMAP_CLAVE: 'contraseña de aplicación',
};

describe('configuración', () => {
  it('con todo lo necesario, devuelve valores tipados y los opcionales con su defecto', () => {
    const config = leerConfig(completo);
    expect(config.puerto).toBe(8080);
    expect(config.imap.puerto).toBe(993);
    expect(config.imap.buzon).toBe('INBOX');
    expect(config.intervaloMinutos).toBe(10);
    expect(config.claveCifrado).toHaveLength(32);
  });

  it('dice TODO lo que falta de una vez, no de a una', () => {
    // Arrancar tres veces para descubrir tres variables es una hora perdida.
    expect(() => leerConfig({})).toThrow(/DATABASE_URL[\s\S]*SERENO_TOKEN/);
    try {
      leerConfig({});
    } catch (error) {
      expect(error instanceof Error ? error.message : '').toContain('SERENO_CLAVE_CIFRADO');
    }
  });

  it('no acepta una clave de cifrado que no mide 32 bytes', () => {
    expect(() => leerConfig({ ...completo, SERENO_CLAVE_CIFRADO: 'Y29ydGE=' })).toThrow(/32 bytes/);
  });

  it('no acepta un token corto: con uno de cuatro letras, el servidor es público', () => {
    expect(() => leerConfig({ ...completo, SERENO_TOKEN: 'abcd' })).toThrow(/token/i);
  });

  it('el mensaje de error no repite el valor de ningún secreto', () => {
    try {
      leerConfig({ ...completo, SERENO_TOKEN: 'abcd', IMAP_CLAVE: 'clave-secreta-real' });
      throw new Error('debía fallar');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      expect(mensaje).not.toContain('clave-secreta-real');
      expect(mensaje).not.toContain('abcd');
    }
  });

  it('lo de Gmail es opcional: sin ello, la fuente es IMAP', () => {
    expect(leerConfig(completo).gmail).toBeNull();
    expect(
      leerConfig({
        ...completo,
        SERENO_GOOGLE_ID: 'id',
        SERENO_GOOGLE_SECRET: 'secreto',
        SERENO_GMAIL_REFRESH_TOKEN: 'token',
      }).gmail,
    ).not.toBeNull();
  });

  it('con Gmail a medias, no se usa: falta algo y adivinar sería peor', () => {
    expect(leerConfig({ ...completo, SERENO_GOOGLE_ID: 'id' }).gmail).toBeNull();
  });

  it('un intervalo absurdo se rechaza en vez de dejar la ingesta muerta', () => {
    expect(() => leerConfig({ ...completo, SERENO_INTERVALO_MINUTOS: '0' })).toThrow();
    expect(() => leerConfig({ ...completo, SERENO_INTERVALO_MINUTOS: '99999' })).toThrow();
  });
});
