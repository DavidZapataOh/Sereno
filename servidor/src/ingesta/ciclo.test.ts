import { randomBytes } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CORREOS } from '@/domain/mail/parsers/fixtures/correos';
import { createInMemoryMailSource } from '@/test/fakes/in-memory-mail-source';

import { crearBaseDePrueba } from '../db/prueba';
import { crearRepositorios, type Repositorios } from '../db/repositorios';

import { ingerirCorreos } from './ciclo';

const observabilidad = { log: () => undefined, captureError: () => undefined };

describe('ciclo de ingesta de correo', () => {
  let base: Awaited<ReturnType<typeof crearBaseDePrueba>>;
  let repos: Repositorios;

  beforeEach(async () => {
    base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it('lee, guarda, parsea y deja los movimientos listos para entregar', async () => {
    const fuente = createInMemoryMailSource([
      CORREOS.bancolombiaCompraste,
      CORREOS.nequiPago,
      CORREOS.bancolombiaPublicidad,
      CORREOS.sinRemitenteConocido,
    ]);

    const corrida = await ingerirCorreos({ fuente, repos, observabilidad }, { limite: 50 });

    expect(corrida).toMatchObject({
      mensajesVistos: 4,
      nuevos: 4,
      movimientosNuevos: 2,
      ignorados: 1,
      desconocidos: 1,
      errores: 0,
    });
    const pendientes = await repos.movimientos.sinEntregar();
    expect(pendientes.map((m) => m.fuente).sort()).toEqual(['bancolombia', 'nequi']);
  });

  it('correr dos veces no duplica nada, y la segunda no vuelve al principio', async () => {
    const fuente = createInMemoryMailSource([CORREOS.bancolombiaCompraste, CORREOS.nequiPago]);
    await ingerirCorreos({ fuente, repos, observabilidad }, { limite: 50 });
    const segunda = await ingerirCorreos({ fuente, repos, observabilidad }, { limite: 50 });

    expect(segunda.mensajesVistos).toBe(0);
    expect(segunda.movimientosNuevos).toBe(0);
    expect(await repos.movimientos.sinEntregar()).toHaveLength(2);
    expect(fuente.peticiones()).toBe(2);
  });

  it('el cursor avanza aunque no haya nada que parsear', async () => {
    const fuente = createInMemoryMailSource([CORREOS.sinRemitenteConocido]);
    await ingerirCorreos({ fuente, repos, observabilidad }, { limite: 50 });
    expect(await repos.cursores.leer('imap')).toBe('1');
  });

  it('un correo que nadie sabe leer queda en revisión, entero, y no para el lote', async () => {
    const roto = {
      ...CORREOS.bancolombiaCompraste,
      id: 'm-roto',
      texto: 'Compraste en COMERCIO DE PRUEBA con tu T.Deb',
    };
    const fuente = createInMemoryMailSource([roto, CORREOS.nequiPago]);

    const corrida = await ingerirCorreos({ fuente, repos, observabilidad }, { limite: 50 });

    expect(corrida.errores).toBe(1);
    expect(corrida.movimientosNuevos).toBe(1);
    const revision = await repos.mensajes.listarParaRevision(10);
    expect(revision.map((m) => m.id)).toEqual(['m-roto']);
    expect(revision[0]?.texto).toContain('COMERCIO DE PRUEBA');
    expect(revision[0]?.motivo).toMatch(/monto|plantilla/i);
  });

  it('un remitente desconocido queda en revisión con su motivo', async () => {
    const fuente = createInMemoryMailSource([CORREOS.sinRemitenteConocido]);
    await ingerirCorreos({ fuente, repos, observabilidad }, { limite: 50 });

    const revision = await repos.mensajes.listarParaRevision(10);
    expect(revision[0]?.motivo).toContain('promociones@tienda.com');
  });

  it('deja una corrida cerrada con sus cuentas', async () => {
    const fuente = createInMemoryMailSource([CORREOS.bancolombiaCompraste]);
    await ingerirCorreos({ fuente, repos, observabilidad }, { limite: 50 });

    const ultima = await repos.corridas.ultima();
    expect(ultima).toMatchObject({ mensajesVistos: 1, movimientosNuevos: 1, error: null });
    expect(ultima?.terminadoEn).not.toBeNull();
  });

  it('si la lectura del correo falla, la corrida se cierra con el error escrito', async () => {
    const fuente = {
      id: 'imap' as const,
      buscar: () => Promise.reject(new Error('IMAP caído')),
    };
    await expect(ingerirCorreos({ fuente, repos, observabilidad }, { limite: 10 })).rejects.toThrow(
      'IMAP caído',
    );

    const ultima = await repos.corridas.ultima();
    expect(ultima?.error).toBe('IMAP caído');
    expect(ultima?.terminadoEn).not.toBeNull();
  });

  it('respeta el límite: no baja más correos de los pedidos', async () => {
    const fuente = createInMemoryMailSource([
      CORREOS.bancolombiaCompraste,
      CORREOS.bancolombiaPagaste,
      CORREOS.bancolombiaRetiraste,
    ]);
    const corrida = await ingerirCorreos({ fuente, repos, observabilidad }, { limite: 2 });
    expect(corrida.mensajesVistos).toBe(2);
    expect(await repos.cursores.leer('imap')).toBe('2');
  });
});
