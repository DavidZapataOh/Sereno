import { randomBytes } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { crearBaseDePrueba } from '../db/prueba';
import { crearRepositorios, type Repositorios } from '../db/repositorios';

import { crearApp } from './app';

const TOKEN = 'token-de-prueba-largo-y-aburrido';
const con = { headers: { authorization: `Bearer ${TOKEN}` } };
const conJson = {
  ...con,
  method: 'POST',
  headers: { ...con.headers, 'content-type': 'application/json' },
};

describe('entrega de movimientos', () => {
  let app: ReturnType<typeof crearApp>;
  let repos: Repositorios;

  beforeEach(async () => {
    const base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
    await repos.mensajes.guardar({
      id: 'm1',
      origen: 'imap',
      remitente: 'alertasynotificaciones@an.notificacionesbancolombia.com',
      asunto: 'Alertas y Notificaciones',
      recibidoEn: new Date('2026-08-30T20:00:00.000Z'),
      texto: 'x',
      html: null,
    });
    await repos.movimientos.guardarLote(
      'm1',
      ['A', 'B', 'C'].map((r) => ({
        fecha: '2026-08-30T00:00:00.000-05:00',
        descripcion: `COMPRA ${r}`,
        monto: 1000,
        moneda: 'COP' as const,
        tipo: 'debito' as const,
        fuente: 'bancolombia' as const,
        referencia: r,
      })),
    );
    app = crearApp({
      repos,
      token: TOKEN,
      observabilidad: { log: () => undefined, captureError: () => undefined },
    });
  });

  it('entrega desde el principio cuando no hay cursor', async () => {
    const res = await app.request('/movimientos', con);
    const cuerpo = (await res.json()) as { movimientos: { referencia: string }[]; hayMas: boolean };
    expect(cuerpo.movimientos.map((m) => m.referencia)).toEqual(['A', 'B', 'C']);
    expect(cuerpo.hayMas).toBe(false);
  });

  it('respeta el límite, dice que hay más y devuelve el cursor para seguir', async () => {
    const primera = await app.request('/movimientos?limite=2', con);
    const p = (await primera.json()) as { cursor: number; hayMas: boolean };
    expect(p.hayMas).toBe(true);

    const segunda = await app.request(`/movimientos?desde=${String(p.cursor)}&limite=2`, con);
    const s = (await segunda.json()) as { movimientos: { referencia: string }[]; hayMas: boolean };
    expect(s.movimientos.map((m) => m.referencia)).toEqual(['C']);
    expect(s.hayMas).toBe(false);
  });

  it('cada movimiento llega con la forma que la app ingiere, y su id determinista', async () => {
    const res = await app.request('/movimientos?limite=1', con);
    const [movimiento] = ((await res.json()) as { movimientos: Record<string, unknown>[] })
      .movimientos;
    expect(movimiento).toMatchObject({
      id: 'bancolombia:A',
      fuente: 'bancolombia',
      monto: 1000,
      moneda: 'COP',
      tipo: 'debito',
    });
    // El monto viaja como número entero, no como texto ni como decimal.
    expect(typeof movimiento?.['monto']).toBe('number');
  });

  it('un cursor que no es un número se rechaza en vez de interpretarse como cero', async () => {
    expect((await app.request('/movimientos?desde=ayer', con)).status).toBe(400);
    expect((await app.request('/movimientos?limite=-1', con)).status).toBe(400);
  });

  it('sin token no entrega nada', async () => {
    expect((await app.request('/movimientos')).status).toBe(401);
  });

  it('confirmar marca lo entregado y es idempotente', async () => {
    const { cursor } = (await (await app.request('/movimientos?limite=2', con)).json()) as {
      cursor: number;
    };
    // Dos veces: confirmar es idempotente.
    for (const intento of [1, 2]) {
      const res = await app.request('/confirmaciones', {
        ...conJson,
        body: JSON.stringify({ cursor }),
      });
      expect(res.status, `intento ${String(intento)}`).toBe(200);
    }
    expect(await repos.movimientos.sinEntregar()).toHaveLength(1);
  });

  it('confirmar sin cursor válido no marca nada', async () => {
    const res = await app.request('/confirmaciones', {
      ...conJson,
      body: JSON.stringify({ cursor: 'todo' }),
    });
    expect(res.status).toBe(400);
    expect(await repos.movimientos.sinEntregar()).toHaveLength(3);
  });

  it('confirmar con un cuerpo que no es JSON tampoco revienta', async () => {
    const res = await app.request('/confirmaciones', { ...conJson, body: 'no soy json' });
    expect(res.status).toBe(400);
  });
});
