import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { leerConfig } from './config';

/**
 * Un valor con pinta de secreto, construido en vez de escrito.
 *
 * `comprobar-secretos` marca cualquier literal largo asignado a un nombre de
 * secreto, y hace bien: no puede distinguir uno falso de uno real. Construirlo
 * deja claro que es de mentira y no gasta la alarma.
 */
const comoSiFuera = (texto: string, veces: number): string => texto.repeat(veces);

/**
 * Valores sintéticos a propósito.
 *
 * La cadena va sin usuario ni contraseña y el token se construye en vez de
 * escribirse: `comprobar-secretos` no distingue un secreto de prueba de uno
 * real —no puede—, y una fixture que parece una credencial acaba enseñando a
 * ignorar la alarma.
 */
const completo = {
  DATABASE_URL: 'postgres://localhost:5432/sereno',
  SERENO_TOKEN: comoSiFuera('t', 30),
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
    // Corto a propósito, y corto también como texto: una fixture larga con
    // pinta de clave dispara `comprobar-secretos`, con razón.
    expect(() => leerConfig({ ...completo, SERENO_CLAVE_CIFRADO: 'corta' })).toThrow(/32 bytes/);
  });

  it('no acepta un token corto: con uno de cuatro letras, el servidor es público', () => {
    expect(() => leerConfig({ ...completo, SERENO_TOKEN: 'abcd' })).toThrow(/token/i);
  });

  it('el mensaje de error no repite el valor de ningún secreto', () => {
    try {
      const clave = comoSiFuera('no-aparece-', 2);
      leerConfig({ ...completo, SERENO_TOKEN: 'abcd', IMAP_CLAVE: clave });
      throw new Error('debía fallar');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      expect(mensaje).not.toContain(comoSiFuera('no-aparece-', 2));
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

  /**
   * Como Gmail: sin claves, el servidor arranca igual y todo lo demás sigue
   * funcionando.
   */
  it('Binance es opcional', () => {
    expect(leerConfig(completo).binance).toBeNull();
  });

  it('con las dos claves, las devuelve', () => {
    const config = leerConfig({
      ...completo,
      BINANCE_API_KEY: comoSiFuera('k', 30),
      BINANCE_API_SECRET: comoSiFuera('s', 30),
    });

    expect(config.binance).toEqual({
      clave: comoSiFuera('k', 30),
      secreto: comoSiFuera('s', 30),
    });
  });

  it('con la clave a medias se niega a arrancar', () => {
    // Usar la mitad de unas credenciales es un fallo en la primera petición.
    expect(() => leerConfig({ ...completo, BINANCE_API_KEY: comoSiFuera('k', 30) })).toThrow(
      /a medias/,
    );
    expect(() => leerConfig({ ...completo, BINANCE_API_SECRET: comoSiFuera('s', 30) })).toThrow(
      /a medias/,
    );
  });

  /**
   * Estos mensajes acaban en los registros de Railway.
   */
  it('el error de configuración no repite el secreto', () => {
    const secreto = comoSiFuera('s', 30);
    try {
      leerConfig({ ...completo, BINANCE_API_SECRET: secreto });
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect(String(error)).not.toContain(secreto);
    }
  });
});

describe('Binance en la configuración', () => {
  const base = (extra: Record<string, string>) => ({ ...completo, ...extra });

  /**
   * El fallo real: pegar la clave en el panel de Railway arrastra un salto de
   * línea con una facilidad pasmosa, y con él Binance devuelve 401 sin decir
   * que sobra un carácter invisible.
   */
  it('recorta espacios y saltos de línea de las claves', () => {
    const config = leerConfig(
      base({ BINANCE_API_KEY: '  clave-larga\n', BINANCE_API_SECRET: 'secreto-largo  ' }),
    );

    expect(config.binance).toEqual({ clave: 'clave-larga', secreto: 'secreto-largo' });
  });

  it('una variable en blanco no se toma por una clave', () => {
    expect(() => leerConfig(base({ BINANCE_API_KEY: '   ', BINANCE_API_SECRET: 'x' }))).toThrow(
      /vac/i,
    );
  });

  it('sin claves, Binance queda en null y el resto sigue', () => {
    expect(leerConfig(base({})).binance).toBeNull();
  });

  it('a medias no vale: media credencial falla en la primera petición', () => {
    expect(() => leerConfig(base({ BINANCE_API_KEY: 'solo-la-clave' }))).toThrow(/a medias/i);
  });
});

describe('el asistente en la configuración', () => {
  const base = (extra: Record<string, string>) => ({ ...completo, ...extra });

  /** Igual que Binance en el sprint 08: sin clave, la app funciona igual. */
  it('sin clave, el asistente queda en null y el resto sigue', () => {
    expect(leerConfig(base({})).anthropic).toBeNull();
    expect(leerConfig(base({})).token).toBe(completo.SERENO_TOKEN);
  });

  it('recorta espacios y saltos de línea', () => {
    expect(leerConfig(base({ ANTHROPIC_API_KEY: '  sk-de-prueba\n' })).anthropic).toEqual({
      clave: 'sk-de-prueba',
      espacio: undefined,
    });
  });

  it('una variable en blanco no se toma por una clave', () => {
    expect(() => leerConfig(base({ ANTHROPIC_API_KEY: '   ' }))).toThrow(/vac/i);
  });

  /**
   * Una clave ligada a una identidad exige decir en qué espacio actúa: la API
   * devuelve 400 sin la cabecera. Fue lo que pasó en la primera consulta real.
   */
  it('lleva el espacio de trabajo cuando está configurado', () => {
    expect(
      leerConfig(base({ ANTHROPIC_API_KEY: 'sk-x', ANTHROPIC_WORKSPACE_ID: ' wrkspc_1 ' }))
        .anthropic,
    ).toEqual({ clave: 'sk-x', espacio: 'wrkspc_1' });
  });

  it('sin espacio de trabajo la clave sigue valiendo: no todas lo necesitan', () => {
    expect(leerConfig(base({ ANTHROPIC_API_KEY: 'sk-x' })).anthropic?.espacio).toBeUndefined();
  });

  it('si la configuración falla, el error no repite la clave', () => {
    const clave = 'sk-ant-secretisima';
    try {
      leerConfig({ ...base({ ANTHROPIC_API_KEY: clave }), SERENO_TOKEN: 'corto' });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(clave);
    }
  });
});
