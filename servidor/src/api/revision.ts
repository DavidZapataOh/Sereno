import type { Hono } from 'hono';

import type { EstadoMensaje, Repositorios } from '../db/repositorios';
import { reprocesarPendientes } from '../ingesta/reprocesar';
import type { Observabilidad } from '../observabilidad';

/** Cuánto del correo se enseña: lo justo para reconocerlo, no el correo entero. */
const EXTRACTO = 280;

const ESTADOS: readonly EstadoMensaje[] = [
  'pendiente',
  'parseado',
  'ignorado',
  'desconocido',
  'error',
];
const POR_DEFECTO: readonly EstadoMensaje[] = ['desconocido', 'error'];

/**
 * Qué estados pedir. Sin validar, un valor raro dejaría el filtro vacío y eso
 * se convierte en «todo»: correos parseados, con su contenido, salidos a
 * pasear sin que nadie los pidiera.
 */
function estadosDe(crudo: string | undefined): readonly EstadoMensaje[] | null {
  if (crudo === undefined || crudo.trim().length === 0) return POR_DEFECTO;
  const pedidos = crudo.split(',').map((e) => e.trim());
  return pedidos.every((e): e is EstadoMensaje => (ESTADOS as readonly string[]).includes(e))
    ? pedidos
    : null;
}

export function montarRevision(
  app: Hono,
  repos: Repositorios,
  observabilidad: Observabilidad,
): void {
  app.get('/revision', async (c) => {
    const pedido = Number(c.req.query('limite') ?? 50);
    const limite = Math.min(Number.isFinite(pedido) && pedido > 0 ? pedido : 50, 200);
    const estados = estadosDe(c.req.query('estado'));
    if (estados === null) return c.json({ error: 'Estado desconocido' }, 400);
    const mensajes = await repos.mensajes.listarParaRevision(limite, estados);
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
