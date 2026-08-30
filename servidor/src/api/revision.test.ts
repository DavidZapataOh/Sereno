import { randomBytes } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { crearBaseDePrueba } from '../db/prueba';
import { crearRepositorios, type Repositorios } from '../db/repositorios';

import { crearApp } from './app';

const TOKEN = 'token-de-prueba-largo-y-aburrido';
const con = { headers: { authorization: `Bearer ${TOKEN}` } };
/** Largo y sin monto: ni el parser de hoy ni el reproceso pueden con él. */
const LARGO = 'Compraste en COMERCIO DE PRUEBA con tu tarjeta, sin decir cuánto. '.repeat(20);

describe('cola de revisión', () => {
  let app: ReturnType<typeof crearApp>;
  let repos: Repositorios;

  beforeEach(async () => {
    const base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
    await repos.mensajes.guardar({
      id: 'm-roto',
      origen: 'imap',
      remitente: 'alertasynotificaciones@an.notificacionesbancolombia.com',
      asunto: 'Alertas y Notificaciones',
      recibidoEn: new Date('2026-08-30T20:00:00.000Z'),
      texto: LARGO,
      html: null,
    });
    await repos.mensajes.marcar('m-roto', 'error', 'Correo de Bancolombia sin monto legible');
    app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: { log: () => undefined, captureError: () => undefined },
    });
  });

  it('lista lo que está en revisión con su motivo', async () => {
    const res = await app.request('/revision', con);
    const cuerpo = (await res.json()) as { mensajes: { id: string; motivo: string }[] };
    expect(cuerpo.mensajes).toHaveLength(1);
    expect(cuerpo.mensajes[0]?.motivo).toMatch(/monto/);
  });

  it('el extracto no se lleva el correo entero', async () => {
    // Es dato bancario: lo justo para reconocerlo, no para leerlo.
    const res = await app.request('/revision', con);
    const cuerpo = (await res.json()) as { mensajes: { extracto: string }[] };
    expect(cuerpo.mensajes[0]?.extracto.length).toBeLessThanOrEqual(280);
    expect(LARGO.length).toBeGreaterThan(280);
  });

  it('reprocesar responde el resumen', async () => {
    const res = await app.request('/revision/reprocesar', { ...con, method: 'POST' });
    expect(await res.json()).toEqual({ revisados: 1, resueltos: 0, movimientosNuevos: 0 });
  });

  it('sin token no se ve nada de la cola', async () => {
    expect((await app.request('/revision')).status).toBe(401);
    expect((await app.request('/revision/reprocesar', { method: 'POST' })).status).toBe(401);
  });

  it('un límite absurdo no tumba la consulta', async () => {
    expect((await app.request('/revision?limite=hola', con)).status).toBe(200);
    expect((await app.request('/revision?limite=99999', con)).status).toBe(200);
  });
});
