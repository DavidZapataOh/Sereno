import { randomBytes } from 'node:crypto';

import { beforeEach, describe, expect, it } from 'vitest';

import { CORREOS } from '@/domain/mail/parsers/fixtures/correos';
import { createInMemoryMailSource } from '@/test/fakes/in-memory-mail-source';

import { crearBaseDePrueba } from '../db/prueba';
import { crearRepositorios, type Repositorios } from '../db/repositorios';

import { ingerirCorreos } from './ciclo';
import { reprocesarPendientes } from './reprocesar';

const observabilidad = { log: () => undefined, captureError: () => undefined };

describe('reprocesar lo que quedó en revisión', () => {
  let repos: Repositorios;

  /** Un correo que el parser de hoy no sabe leer, ya en la cola. */
  beforeEach(async () => {
    const base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
    const roto = {
      ...CORREOS.bancolombiaCompraste,
      id: 'm-roto',
      texto: 'Compraste en COMERCIO DE PRUEBA con tu T.Deb',
    };
    await ingerirCorreos(
      { fuente: createInMemoryMailSource([roto]), repos, observabilidad },
      { limite: 10 },
    );
  });

  const guardarComoRoto = async (id: string, texto: string): Promise<void> => {
    await repos.mensajes.guardar({
      id,
      origen: 'imap',
      remitente: CORREOS.bancolombiaCompraste.remitente,
      asunto: CORREOS.bancolombiaCompraste.asunto,
      recibidoEn: new Date(CORREOS.bancolombiaCompraste.recibidoEn),
      texto,
      html: null,
    });
    await repos.mensajes.marcar(id, 'error', 'el formato de entonces');
  };

  it('sin cambios en los parsers, lo que no se pudo leer sigue sin poderse', async () => {
    const r = await reprocesarPendientes({ repos, observabilidad }, { limite: 10 });
    expect(r).toMatchObject({ revisados: 1, resueltos: 0, movimientosNuevos: 0 });
    expect(await repos.mensajes.listarParaRevision(10)).toHaveLength(1);
  });

  it('un correo que ya se puede leer sale de la cola y deja su movimiento', async () => {
    // Se simula «el parser mejoró» con un mensaje que hoy sí se lee.
    await guardarComoRoto('m-bueno', CORREOS.bancolombiaCompraste.texto);

    const r = await reprocesarPendientes({ repos, observabilidad }, { limite: 10 });
    expect(r.resueltos).toBe(1);
    expect(r.movimientosNuevos).toBe(1);
    expect((await repos.mensajes.listarParaRevision(10)).map((m) => m.id)).toEqual(['m-roto']);
  });

  it('reprocesar dos veces no duplica movimientos', async () => {
    // El id de un movimiento es determinista: volver a extraerlo cae sobre la
    // misma fila.
    await guardarComoRoto('m-bueno', CORREOS.bancolombiaCompraste.texto);
    await reprocesarPendientes({ repos, observabilidad }, { limite: 10 });
    await repos.mensajes.marcar('m-bueno', 'error', 'otra vez');
    const segunda = await reprocesarPendientes({ repos, observabilidad }, { limite: 10 });

    expect(segunda.movimientosNuevos).toBe(0);
    expect(await repos.movimientos.sinEntregar()).toHaveLength(1);
  });

  it('lo que resulta ser publicidad sale de la cola sin dejar movimiento', async () => {
    await guardarComoRoto('m-publicidad', CORREOS.bancolombiaPublicidad.texto);
    const r = await reprocesarPendientes({ repos, observabilidad }, { limite: 10 });
    expect(r.resueltos).toBe(1);
    expect(r.movimientosNuevos).toBe(0);
  });
});
