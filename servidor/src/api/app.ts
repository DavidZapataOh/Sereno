import { timingSafeEqual } from 'node:crypto';

import { Hono } from 'hono';

import type { Repositorios } from '../db/repositorios';
import type { Observabilidad } from '../observabilidad';

import { montarMovimientos } from './movimientos';
import { montarRevision } from './revision';
import { montarSaldos, type MotivoSinBinance, type SaldosBinance } from './saldos';

export interface Dependencias {
  repos: Repositorios;
  token: string;
  observabilidad: Observabilidad;
  /** Ausente si no hay claves de Binance: la ruta lo dice en vez de mentir. */
  saldosBinance?: SaldosBinance;
  /** Por qué no hay saldos. Sin claves, o con una clave que fue rechazada. */
  motivoSinBinance?: MotivoSinBinance;
}

/**
 * Compara en tiempo constante. Con `===`, el tiempo de respuesta filtra
 * cuántos caracteres del token acertó quien prueba.
 */
function tokenValido(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function crearApp(deps: Dependencias) {
  const app = new Hono();

  // Un solo usuario, un solo token: no hay sesiones ni usuarios que modelar.
  app.use('*', async (c, next) => {
    const cabecera = c.req.header('authorization') ?? '';
    const recibido = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
    if (!tokenValido(recibido, deps.token)) return c.json({ error: 'No autorizado' }, 401);
    await next();
  });

  app.get('/salud', async (c) => {
    const [ultima, pendientes, enRevision] = await Promise.all([
      deps.repos.corridas.ultima(),
      deps.repos.movimientos.sinEntregar(),
      deps.repos.mensajes.listarParaRevision(200),
    ]);
    return c.json({
      estado: 'vivo',
      version: process.env['SERENO_VERSION'] ?? 'dev',
      // Lo que el teléfono aún no se ha traído, y lo que nadie supo leer.
      movimientosPendientes: pendientes.length,
      enRevision: enRevision.length,
      ultimaCorrida:
        ultima === null
          ? null
          : {
              iniciadoEn: ultima.iniciadoEn.toISOString(),
              terminadoEn: ultima.terminadoEn?.toISOString() ?? null,
              error: ultima.error,
            },
    });
  });

  montarMovimientos(app, deps.repos);
  montarRevision(app, deps.repos, deps.observabilidad);
  montarSaldos(app, deps.observabilidad, deps.saldosBinance, deps.motivoSinBinance);

  app.notFound((c) => c.json({ error: 'No existe' }, 404));

  // Lo que se responde no cuenta nada; lo que se registra lo cuenta todo.
  app.onError((error, c) => {
    deps.observabilidad.captureError(error, { ruta: c.req.path });
    return c.json({ error: 'Algo falló en el servidor' }, 500);
  });

  return app;
}
