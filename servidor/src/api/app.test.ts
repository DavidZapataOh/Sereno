import { randomBytes } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { crearBaseDePrueba } from '../db/prueba';
import { crearRepositorios, type Repositorios } from '../db/repositorios';

import { crearApp } from './app';

const TOKEN = 'token-de-prueba-largo-y-aburrido';
const con = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

describe('API del servidor', () => {
  let app: ReturnType<typeof crearApp>;
  let repos: Repositorios;
  let errores: unknown[];

  beforeEach(async () => {
    const base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
    errores = [];
    app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: {
        log: () => undefined,
        captureError: (error) => {
          errores.push(error);
        },
      },
    });
  });

  it('sin token no responde nada útil', async () => {
    const res = await app.request('/salud');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'No autorizado' });
  });

  it('con un token equivocado tampoco, y no dice en qué se equivocó', async () => {
    const res = await app.request('/salud', con('otro-token-cualquiera'));
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain(TOKEN);
  });

  it('un token con el prefijo correcto pero más corto no cuela', async () => {
    // `timingSafeEqual` revienta con longitudes distintas: hay que comprobarlo
    // antes, y comprobar que ese camino no lanza.
    const res = await app.request('/salud', con(TOKEN.slice(0, 10)));
    expect(res.status).toBe(401);
  });

  it('con el token correcto dice que está vivo y cuándo corrió la última vez', async () => {
    const id = await repos.corridas.abrir();
    await repos.corridas.cerrar(id, {
      mensajesVistos: 2,
      movimientosNuevos: 1,
      desconocidos: 0,
      error: null,
    });

    const res = await app.request('/salud', con(TOKEN));
    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as {
      estado: string;
      ultimaCorrida: { error: string | null; terminadoEn: string | null };
    };
    expect(cuerpo.estado).toBe('vivo');
    expect(cuerpo.ultimaCorrida.error).toBeNull();
    expect(cuerpo.ultimaCorrida.terminadoEn).not.toBeNull();
  });

  it('dice cuánto queda por entregar y cuánto en revisión', async () => {
    const res = await app.request('/salud', con(TOKEN));
    expect(await res.json()).toMatchObject({ movimientosPendientes: 0, enRevision: 0 });
  });

  it('sin ninguna corrida todavía, lo dice en vez de inventar', async () => {
    const res = await app.request('/salud', con(TOKEN));
    expect(((await res.json()) as { ultimaCorrida: unknown }).ultimaCorrida).toBeNull();
  });

  it('un fallo interno responde en genérico y se registra entero', async () => {
    const rota = crearApp({
      repos: {
        ...repos,
        corridas: {
          ...repos.corridas,
          ultima: () => Promise.reject(new Error('la base se cayó con la contraseña hunter2')),
        },
      },
      token: TOKEN,
      observabilidad: {
        log: () => undefined,
        captureError: (error) => {
          errores.push(error);
        },
      },
    });

    const res = await rota.request('/salud', con(TOKEN));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('hunter2');
    expect(errores).toHaveLength(1);
  });

  it('una ruta que no existe responde 404 en JSON, no en HTML', async () => {
    const res = await app.request('/lo-que-sea', con(TOKEN));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
