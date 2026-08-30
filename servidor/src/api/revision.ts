import type { Hono } from 'hono';

import type { Repositorios } from '../db/repositorios';
import { reprocesarPendientes } from '../ingesta/reprocesar';
import type { Observabilidad } from '../observabilidad';

/** Cuánto del correo se enseña: lo justo para reconocerlo, no el correo entero. */
const EXTRACTO = 280;

export function montarRevision(
  app: Hono,
  repos: Repositorios,
  observabilidad: Observabilidad,
): void {
  app.get('/revision', async (c) => {
    const pedido = Number(c.req.query('limite') ?? 50);
    const limite = Math.min(Number.isFinite(pedido) && pedido > 0 ? pedido : 50, 200);
    const mensajes = await repos.mensajes.listarParaRevision(limite);
    return c.json({
      mensajes: mensajes.map((m) => ({
        id: m.id,
        remitente: m.remitente,
        asunto: m.asunto,
        recibidoEn: m.recibidoEn.toISOString(),
        estado: m.estado,
        motivo: m.motivo,
        extracto: m.texto.slice(0, EXTRACTO),
      })),
    });
  });

  app.post('/revision/reprocesar', async (c) =>
    c.json(await reprocesarPendientes({ repos, observabilidad }, { limite: 200 })),
  );
}
