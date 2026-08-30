import type { Hono } from 'hono';
import { z } from 'zod';

import type { Repositorios } from '../db/repositorios';

const consulta = z.object({
  desde: z.coerce.number().int().nonnegative().default(0),
  limite: z.coerce.number().int().positive().max(500).default(200),
});
const confirmacion = z.object({ cursor: z.number().int().nonnegative() });

/**
 * Entrega por cursor.
 *
 * `secuencia` la asigna Postgres y solo crece, así que el dispositivo no
 * necesita saber de fechas ni de paginación: recuerda un número. El monto
 * vuelve a entero, que es como lo entiende el dominio; en la base viaja como
 * texto para no perder precisión en ninguna escala.
 */
export function montarMovimientos(app: Hono, repos: Repositorios): void {
  app.get('/movimientos', async (c) => {
    const parametros = consulta.safeParse({
      desde: c.req.query('desde'),
      limite: c.req.query('limite'),
    });
    if (!parametros.success) return c.json({ error: 'Parámetros inválidos' }, 400);

    const pagina = await repos.movimientos.desde(parametros.data.desde, parametros.data.limite);
    return c.json({
      movimientos: pagina.movimientos.map((m) => ({
        id: m.id,
        secuencia: m.secuencia,
        fecha: m.fecha,
        descripcion: m.descripcion,
        monto: Number(m.monto),
        moneda: m.moneda,
        tipo: m.tipo,
        fuente: m.fuente,
        referencia: m.referencia,
      })),
      cursor: pagina.cursor,
      hayMas: pagina.hayMas,
    });
  });

  app.post('/confirmaciones', async (c) => {
    const cuerpo = confirmacion.safeParse(await c.req.json().catch(() => null));
    if (!cuerpo.success) return c.json({ error: 'Cursor inválido' }, 400);
    await repos.movimientos.confirmarHasta(cuerpo.data.cursor);
    return c.json({ confirmados: true });
  });
}
