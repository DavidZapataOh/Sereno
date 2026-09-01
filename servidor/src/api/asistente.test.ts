import { randomBytes } from 'node:crypto';

import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resumenPublicable } from '@/domain/assistant/publishable-summary';

import { crearBaseDePrueba } from '../db/prueba';
import { crearRepositorios, type Repositorios } from '../db/repositorios';

import { crearApp } from './app';
import { TOPE_DIARIO } from './asistente';

const TOKEN = 'token-de-prueba-largo-y-aburrido';
const con = { authorization: `Bearer ${TOKEN}` };

const sinRuido = { log: () => undefined, captureError: () => undefined };

const RESUMEN = resumenPublicable({
  gastoPorCategoria: { mercado: 620_000 },
  saldoTotal: 3_904,
  deudaTotal: 1_897_917,
  patrimonio: -1_814_013,
  patrimonioHace30Dias: null,
  tasaDeAhorroPct: null,
  mesesDeColchon: null,
  ingresoMensual: null,
});

const RESPUESTA = {
  respuesta: 'No te alcanza sin tocar la deuda.',
  cifrasUsadas: ['saldoTotal', 'deudaTotal'],
  tokens: { entrada: 400, salida: 120 },
};

function consulta(cuerpo: unknown, cabeceras: Record<string, string> = con) {
  return {
    method: 'POST',
    headers: { ...cabeceras, 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  };
}

describe('el asistente', () => {
  let repos: Repositorios;

  beforeEach(async () => {
    const base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
  });

  const app = (extra: Record<string, unknown> = {}) =>
    crearApp({
      repos,
      token: TOKEN,
      observabilidad: sinRuido,
      preguntar: () => Promise.resolve(RESPUESTA),
      ...extra,
    });

  it('responde con las cifras que dijo haber usado y lo que costó', async () => {
    const res = await app().request(
      '/asistente',
      consulta({ resumen: RESUMEN, pregunta: '¿me alcanza?' }),
    );

    expect(res.status).toBe(200);
    const cuerpo = (await res.json()) as Record<string, unknown>;
    expect(cuerpo['cifrasUsadas']).toEqual(['saldoTotal', 'deudaTotal']);
    // Es plata de David: la cifra se enseña, aunque sean centavos.
    expect(cuerpo['costoUsd']).toBeGreaterThan(0);
  });

  it('sin token no responde', async () => {
    const res = await app().request(
      '/asistente',
      consulta({ resumen: RESUMEN, pregunta: 'hola' }, {}),
    );

    expect(res.status).toBe(401);
  });

  /** Igual que `/saldos` con Binance: «no configurado» ≠ «no hay nada». */
  it('sin clave configurada responde 503 diciendo cuál falta', async () => {
    const res = await app({ preguntar: undefined }).request(
      '/asistente',
      consulta({ resumen: RESUMEN, pregunta: 'hola' }),
    );

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      motivo: 'sin-clave',
      falta: 'ANTHROPIC_API_KEY',
    });
  });

  /**
   * La frontera se defiende en los dos lados: el servidor no reenvía lo que no
   * reconoce, aunque el teléfono se equivoque.
   */
  it('rechaza un cuerpo que traiga algo que no es el resumen agregado', async () => {
    const preguntar = vi.fn(() => Promise.resolve(RESPUESTA));

    const res = await app({ preguntar }).request(
      '/asistente',
      consulta({
        resumen: { ...RESUMEN, descripcion: 'COMPRA RAPPI*BURGER 4512' },
        pregunta: '¿cuánto llevo en Rappi?',
      }),
    );

    expect(res.status).toBe(400);
    // Y no se limpia y se reenvía: no se llama a nadie.
    expect(preguntar).not.toHaveBeenCalled();
  });

  it('una categoría que no es de la taxonomía tampoco pasa', async () => {
    const res = await app().request(
      '/asistente',
      consulta({
        resumen: { ...RESUMEN, gastoPorCategoria: { 'RAPPI*BURGER 4512': 30_000 } },
        pregunta: 'hola',
      }),
    );

    expect(res.status).toBe(400);
  });

  it('una pregunta vacía no gasta una consulta', async () => {
    const preguntar = vi.fn(() => Promise.resolve(RESPUESTA));

    const res = await app({ preguntar }).request(
      '/asistente',
      consulta({ resumen: RESUMEN, pregunta: '   ' }),
    );

    expect(res.status).toBe(400);
    expect(preguntar).not.toHaveBeenCalled();
  });

  /** Es dinero de David por una función accesoria. */
  it('hay tope de consultas por día, y al pasarlo lo dice', async () => {
    const servidor = app();
    const pedir = () =>
      servidor.request('/asistente', consulta({ resumen: RESUMEN, pregunta: 'hola' }));

    for (let i = 0; i < TOPE_DIARIO; i += 1) expect((await pedir()).status).toBe(200);

    const res = await pedir();
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ motivo: 'tope-diario', tope: TOPE_DIARIO });
  });

  it('el tope es por día: mañana vuelve a caber', async () => {
    let hoy = new Date('2026-09-01T10:00:00Z');
    const servidor = app({ ahora: () => hoy });
    const pedir = () =>
      servidor.request('/asistente', consulta({ resumen: RESUMEN, pregunta: 'hola' }));

    for (let i = 0; i < TOPE_DIARIO; i += 1) await pedir();
    expect((await pedir()).status).toBe(429);

    hoy = new Date('2026-09-02T10:00:00Z');
    expect((await pedir()).status).toBe(200);
  });

  /**
   * Un mensaje de la API puede llevar la cabecera que se envió, y ahí va la
   * clave. Lo que se responde es una frase de una lista cerrada.
   */
  it('si la API falla, el error no lleva la clave', async () => {
    const clave = 'sk-ant-secretisima';
    const preguntar = () => Promise.reject(new Error(`401 con x-api-key: ${clave}`));

    const res = await app({ preguntar }).request(
      '/asistente',
      consulta({ resumen: RESUMEN, pregunta: 'hola' }),
    );

    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(clave);
  });

  it('un error de tasa se distingue: se puede reintentar', async () => {
    const preguntar = () =>
      Promise.reject(new Anthropic.RateLimitError(429, undefined, 'muchas', new Headers()));

    const res = await app({ preguntar }).request(
      '/asistente',
      consulta({ resumen: RESUMEN, pregunta: 'hola' }),
    );

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ motivo: 'tasa' });
  });

  it('una consulta que falló no gasta del tope', async () => {
    const preguntar = vi.fn(() => Promise.reject(new Error('se cayó')));
    const servidor = app({ preguntar });

    for (let i = 0; i < TOPE_DIARIO + 1; i += 1) {
      const res = await servidor.request(
        '/asistente',
        consulta({ resumen: RESUMEN, pregunta: 'hola' }),
      );
      expect(res.status).toBe(502);
    }
  });
});
