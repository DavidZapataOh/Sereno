import { randomBytes } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { crearBaseDePrueba } from './prueba';
import { crearRepositorios, type Repositorios } from './repositorios';
import { mensajes as tablaMensajes } from './schema';

const mensaje = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  origen: 'imap' as const,
  remitente: 'alertasynotificaciones@an.notificacionesbancolombia.com',
  asunto: 'Alertas y Notificaciones',
  recibidoEn: new Date('2026-08-30T15:00:00.000Z'),
  texto: 'Compraste $45.000 en EXITO SUR',
  html: null,
  ...extra,
});
const movimiento = (referencia: string) => ({
  fecha: '2026-08-30T00:00:00.000-05:00',
  descripcion: 'COMPRA EXITO SUR',
  monto: 45000,
  moneda: 'COP' as const,
  tipo: 'debito' as const,
  fuente: 'bancolombia' as const,
  referencia,
});

describe('repositorios del servidor', () => {
  let base: Awaited<ReturnType<typeof crearBaseDePrueba>>;
  let repos: Repositorios;

  beforeEach(async () => {
    base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it('guarda un mensaje una sola vez y sabe si ya lo vio', async () => {
    expect(await repos.mensajes.existe('m1')).toBe(false);
    await repos.mensajes.guardar(mensaje('m1'));
    await repos.mensajes.guardar(mensaje('m1', { asunto: 'otro' }));
    expect(await repos.mensajes.existe('m1')).toBe(true);

    const [fila] = await base.db.select().from(tablaMensajes);
    // El primer procesamiento manda: guardar de nuevo no reescribe.
    expect(fila?.asunto).toBe('Alertas y Notificaciones');
  });

  it('guarda los movimientos de un mensaje con id determinista y sin duplicar', async () => {
    await repos.mensajes.guardar(mensaje('m1'));
    expect(await repos.movimientos.guardarLote('m1', [movimiento('R1'), movimiento('R2')])).toBe(2);
    expect(await repos.movimientos.guardarLote('m1', [movimiento('R1')])).toBe(0);

    const pagina = await repos.movimientos.desde(0, 10);
    expect(pagina.movimientos.map((m) => m.id)).toEqual(['bancolombia:R1', 'bancolombia:R2']);
    expect(pagina.hayMas).toBe(false);
  });

  it('un lote vacío no toca la base', async () => {
    await repos.mensajes.guardar(mensaje('m1'));
    expect(await repos.movimientos.guardarLote('m1', [])).toBe(0);
  });

  it('entrega por cursor, en orden, y dice si hay más', async () => {
    await repos.mensajes.guardar(mensaje('m1'));
    await repos.movimientos.guardarLote('m1', ['A', 'B', 'C'].map(movimiento));

    const primera = await repos.movimientos.desde(0, 2);
    expect(primera.movimientos).toHaveLength(2);
    expect(primera.hayMas).toBe(true);

    const segunda = await repos.movimientos.desde(primera.cursor, 2);
    expect(segunda.movimientos.map((m) => m.referencia)).toEqual(['C']);
    expect(segunda.hayMas).toBe(false);
  });

  it('confirmar marca lo entregado hasta el cursor y no toca lo posterior', async () => {
    await repos.mensajes.guardar(mensaje('m1'));
    await repos.movimientos.guardarLote('m1', [movimiento('A'), movimiento('B')]);
    const { cursor } = await repos.movimientos.desde(0, 1);

    await repos.movimientos.confirmarHasta(cursor);
    expect((await repos.movimientos.sinEntregar()).map((m) => m.referencia)).toEqual(['B']);
  });

  it('el monto viaja como texto de entero: ningún float toca el dinero', async () => {
    await repos.mensajes.guardar(mensaje('m1'));
    await repos.movimientos.guardarLote('m1', [{ ...movimiento('A'), monto: 999_999_999 }]);
    const [guardado] = (await repos.movimientos.desde(0, 1)).movimientos;
    expect(guardado?.monto).toBe('999999999');
    expect(typeof guardado?.monto).toBe('string');
  });

  it('marca un mensaje que nadie supo leer, con su motivo, y lo lista para revisión', async () => {
    await repos.mensajes.guardar(mensaje('m1'));
    await repos.mensajes.marcar('m1', 'desconocido', 'Ningún parser reconoce este remitente');

    const revision = await repos.mensajes.listarParaRevision(10);
    expect(revision).toHaveLength(1);
    expect(revision[0]?.motivo).toMatch(/parser/);
    expect(revision[0]?.texto).toContain('EXITO SUR');
  });

  it('el cuerpo del correo no se puede leer directamente en la base', async () => {
    await repos.mensajes.guardar(mensaje('m1'));
    const [fila] = await base.db.select().from(tablaMensajes);
    expect(fila?.texto).not.toContain('EXITO');
    expect(fila?.texto.startsWith('v1.')).toBe(true);

    // Y lo que sale por el repositorio sí se lee.
    await repos.mensajes.marcar('m1', 'desconocido', 'x');
    expect((await repos.mensajes.listarParaRevision(1))[0]?.texto).toContain('EXITO SUR');
  });

  it('lo parseado y lo ignorado no están en la cola de revisión', async () => {
    await repos.mensajes.guardar(mensaje('m1'));
    await repos.mensajes.guardar(mensaje('m2'));
    await repos.mensajes.marcar('m1', 'parseado');
    await repos.mensajes.marcar('m2', 'ignorado');
    expect(await repos.mensajes.listarParaRevision(10)).toEqual([]);
  });

  it('el cursor de cada origen se lee y se escribe por separado', async () => {
    expect(await repos.cursores.leer('imap')).toBeNull();
    await repos.cursores.escribir('imap', '4471');
    await repos.cursores.escribir('imap', '4490');
    await repos.cursores.escribir('gmail', 'h-99');
    expect(await repos.cursores.leer('imap')).toBe('4490');
    expect(await repos.cursores.leer('gmail')).toBe('h-99');
  });

  it('una corrida se abre, se cierra con sus cuentas, y la última es la más reciente', async () => {
    const vieja = await repos.corridas.abrir();
    await repos.corridas.cerrar(vieja, {
      mensajesVistos: 3,
      movimientosNuevos: 2,
      desconocidos: 1,
      error: null,
    });
    const nueva = await repos.corridas.abrir();

    const ultima = await repos.corridas.ultima();
    expect(ultima?.id).toBe(nueva);
    expect(ultima?.terminadoEn).toBeNull();
  });

  it('sin ninguna corrida, la última es null en vez de inventarse una', async () => {
    expect(await repos.corridas.ultima()).toBeNull();
  });

  it('borrar un mensaje se lleva sus movimientos: no quedan huérfanos', async () => {
    await repos.mensajes.guardar(mensaje('m1'));
    await repos.movimientos.guardarLote('m1', [movimiento('A')]);
    await base.db.delete(tablaMensajes);
    expect(await repos.movimientos.sinEntregar()).toEqual([]);
  });
});

describe('corridas huérfanas', () => {
  let base: Awaited<ReturnType<typeof crearBaseDePrueba>>;
  let repos: Repositorios;

  beforeEach(async () => {
    base = await crearBaseDePrueba();
    repos = crearRepositorios(base.db, { clave: randomBytes(32) });
  });
  afterEach(async () => {
    await base.cerrar();
  });

  it('cierra al arrancar la pasada que un reinicio dejó abierta', async () => {
    await repos.corridas.abrir();

    expect(await repos.corridas.cerrarHuerfanas()).toBe(1);

    const ultima = await repos.corridas.ultima();
    expect(ultima?.terminadoEn).not.toBeNull();
    expect(ultima?.error).toContain('reinició');
  });

  it('no toca una pasada ya cerrada', async () => {
    const id = await repos.corridas.abrir();
    await repos.corridas.cerrar(id, {
      mensajesVistos: 3,
      movimientosNuevos: 2,
      desconocidos: 0,
      error: null,
    });

    expect(await repos.corridas.cerrarHuerfanas()).toBe(0);
    expect((await repos.corridas.ultima())?.error).toBeNull();
  });
});
