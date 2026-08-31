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

/**
 * Un correo que ningún parser reconoce como movimiento se marca «ignorado» y
 * **no se ve en ninguna parte**. Eso está bien para la publicidad del banco y
 * mal para todo lo demás: el estado de cuenta mensual de una tarjeta cae ahí,
 * y es justo el correo que el sprint 07 necesita encontrar.
 */
describe('cola de revisión — lo ignorado', () => {
  let app: ReturnType<typeof crearApp>;
  let repos: Repositorios;

  beforeEach(async () => {
    const base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
    for (const [id, estado, asunto] of [
      ['m-error', 'error', 'Alertas y Notificaciones'],
      ['m-ignorado', 'ignorado', 'Tu estado de cuenta de agosto'],
      ['m-parseado', 'parseado', 'Compraste $45.000'],
    ] as const) {
      await repos.mensajes.guardar({
        id,
        origen: 'imap',
        remitente: 'noreply@rappicard.co',
        asunto,
        recibidoEn: new Date('2026-08-30T20:00:00.000Z'),
        texto: 'cuerpo de prueba',
        html: null,
      });
      await repos.mensajes.marcar(id, estado, estado === 'error' ? 'sin monto' : undefined);
    }
    app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: { log: () => undefined, captureError: () => undefined },
    });
  });

  it('por defecto sigue enseñando solo lo que hay que arreglar', async () => {
    const res = await app.request('/revision', con);
    const cuerpo = (await res.json()) as { mensajes: { id: string }[] };
    expect(cuerpo.mensajes.map((m) => m.id)).toEqual(['m-error']);
  });

  it('con ?estado=ignorado enseña lo que se archivó en silencio', async () => {
    const res = await app.request('/revision?estado=ignorado', con);
    const cuerpo = (await res.json()) as { mensajes: { id: string; asunto: string }[] };
    expect(cuerpo.mensajes.map((m) => m.id)).toEqual(['m-ignorado']);
    expect(cuerpo.mensajes[0]?.asunto).toContain('estado de cuenta');
  });

  it('acepta varios estados a la vez', async () => {
    const res = await app.request('/revision?estado=error,ignorado', con);
    const cuerpo = (await res.json()) as { mensajes: { id: string }[] };
    expect(cuerpo.mensajes.map((m) => m.id).sort()).toEqual(['m-error', 'm-ignorado']);
  });

  it('un estado que no existe no devuelve la tabla entera', async () => {
    // Sin validación, un filtro vacío se convierte en «todo», y eso saca a
    // pasear correos parseados —con su contenido— sin que nadie los pidiera.
    const res = await app.request('/revision?estado=loquesea', con);
    expect(res.status).toBe(400);
  });
});
