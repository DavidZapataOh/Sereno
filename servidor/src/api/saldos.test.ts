import { randomBytes } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { crearBaseDePrueba } from '../db/prueba';
import { crearRepositorios, type Repositorios } from '../db/repositorios';

import { crearApp } from './app';

const TOKEN = 'token-de-prueba-largo-y-aburrido';
const con = { headers: { authorization: `Bearer ${TOKEN}` } };

const sinRuido = { log: () => undefined, captureError: () => undefined };

describe('saldos de Binance', () => {
  let repos: Repositorios;

  beforeEach(async () => {
    const base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
  });

  it('devuelve los saldos que da Binance', async () => {
    const app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: sinRuido,
      saldosBinance: () =>
        Promise.resolve([
          { activo: 'USDC', cantidad: 85_761n },
          { activo: 'USDT', cantidad: 1_000_000n },
        ]),
    });

    const res = await app.request('/saldos', con);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      // Como texto: un entero de escala cripto no cabe en un `number` de JSON
      // sin perder dígitos, y perderlos aquí es perder plata.
      saldos: [
        { activo: 'USDC', cantidad: '85761' },
        { activo: 'USDT', cantidad: '1000000' },
      ],
    });
  });

  /**
   * Sin claves configuradas el servidor arranca igual —lo dice el plan 01—, y
   * la ruta tiene que decirlo en vez de fingir que no tienes nada: cero y «no
   * configurado» son cosas distintas.
   */
  it('sin Binance configurado lo dice, y no devuelve cero', async () => {
    const app = crearApp({ repos, token: TOKEN, observabilidad: sinRuido });

    const res = await app.request('/saldos', con);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ motivo: 'sin-claves' });
  });

  /**
   * «No hay claves» y «la clave fue rechazada» piden cosas distintas —añadir
   * dos variables, o revisar la que ya está— y desde fuera se veían igual:
   * hubo que mirar los registros de Railway para distinguirlas.
   */
  it('una clave rechazada se distingue de una que falta', async () => {
    const app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: sinRuido,
      motivoSinBinance: 'clave-rechazada',
      detalleSinBinance:
        'Binance respondió 451 (0): Service unavailable from a restricted location',
    });

    const res = await app.request('/saldos', con);

    expect(res.status).toBe(503);
    const cuerpo = (await res.json()) as { error: string; motivo: string };
    expect(cuerpo.motivo).toBe('clave-rechazada');
  });

  /**
   * El detalle real y no un consejo genérico: «revisa la clave» sería un mal
   * consejo cuando lo que pasa es que Binance bloquea la región desde la que
   * sale la petición, y mandaría a mirar donde no es —otra vez—.
   */
  it('el motivo llega tal cual dice Binance', async () => {
    const app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: sinRuido,
      motivoSinBinance: 'clave-rechazada',
      detalleSinBinance:
        'Binance respondió 451 (0): Service unavailable from a restricted location',
    });

    const cuerpo = (await (await app.request('/saldos', con)).json()) as { error: string };

    expect(cuerpo.error).toMatch(/451/);
    expect(cuerpo.error).toMatch(/restricted location/);
  });

  /**
   * Si Binance falla, **no** se devuelve una lista vacía: el teléfono la
   * tomaría por «no tienes nada» y borraría el saldo de la pantalla.
   */
  it('si Binance falla responde error, nunca una lista vacía', async () => {
    const app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: sinRuido,
      saldosBinance: () => Promise.reject(new Error('Binance rechazó la petición (-1021)')),
    });

    const res = await app.request('/saldos', con);

    expect(res.status).toBe(502);
    expect((await res.json()) as { saldos?: unknown }).not.toHaveProperty('saldos');
  });

  it('sin token no se puede consultar', async () => {
    const app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: sinRuido,
      saldosBinance: () => Promise.resolve([]),
    });

    expect((await app.request('/saldos')).status).toBe(401);
  });

  it('un saldo en cero se devuelve como cero, no se omite', async () => {
    // «Miré y no hay» es información; omitirlo lo vuelve indistinguible de un
    // activo que no se sigue.
    const app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: sinRuido,
      saldosBinance: () => Promise.resolve([{ activo: 'USDT', cantidad: 0n }]),
    });

    const res = await app.request('/saldos', con);

    await expect(res.json()).resolves.toEqual({ saldos: [{ activo: 'USDT', cantidad: '0' }] });
  });
});
