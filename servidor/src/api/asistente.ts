import type { Hono } from 'hono';
import { z } from 'zod';

import { resumenPublicableSchema } from '@/domain/assistant/publishable-summary';

import {
  costoDe,
  explicacionDe,
  motivoDeError,
  type RespuestaAsistente,
} from '../asistente/cliente';
import type { Observabilidad } from '../observabilidad';

/** Quién responde. Ausente si no hay clave configurada. */
export type Preguntar = (resumen: unknown, pregunta: string) => Promise<RespuestaAsistente>;

/**
 * Cuántas consultas caben en un día.
 *
 * Es dinero real de David por una función accesoria. Veinte preguntas al día
 * son muchas más de las que nadie hace, y a la vez un techo que un bucle no
 * puede convertir en una factura.
 */
export const TOPE_DIARIO = 20;

/** Lo más largo que puede ser una pregunta. Lo demás es pegar un texto. */
const LARGO_MAXIMO = 500;

/**
 * Un contador por día, en memoria.
 *
 * Se pierde al reiniciar el servidor, y está asumido: el tope existe para que
 * un bucle no gaste una factura, no para llevar contabilidad. Guardarlo en
 * Postgres sería una tabla y una migración para proteger unos centavos.
 */
function crearTope(ahora: () => Date) {
  let dia = '';
  let cuantas = 0;
  return {
    cabe: (): boolean => {
      const hoy = ahora().toISOString().slice(0, 10);
      if (hoy !== dia) {
        dia = hoy;
        cuantas = 0;
      }
      return cuantas < TOPE_DIARIO;
    },
    contar: (): void => {
      cuantas += 1;
    },
  };
}

/**
 * El asistente, detrás del servidor.
 *
 * **La frontera se defiende en los dos lados.** El teléfono manda solo cifras
 * agregadas, pero aquí se vuelve a comprobar con el mismo esquema del dominio:
 * un fallo en la app no puede acabar mandando un comercio a un tercero. Lo que
 * no encaja se rechaza entero, no se limpia y se reenvía.
 *
 * Y **ningún error sale hacia fuera tal cual**: un mensaje de la API puede
 * llevar la cabecera que se envió, y ahí va la clave. Se responde una frase de
 * una lista cerrada y el detalle va al registro.
 */
export function montarAsistente(
  app: Hono,
  observabilidad: Observabilidad,
  preguntar?: Preguntar,
  ahora: () => Date = () => new Date(),
): void {
  const tope = crearTope(ahora);

  app.post('/asistente', async (c) => {
    if (preguntar === undefined) {
      // 503 y no 500: no está configurado, que no es lo mismo que roto. Igual
      // que `/saldos` sin claves de Binance, y se dice cuál falta.
      return c.json(
        {
          error: 'El asistente no está configurado',
          motivo: 'sin-clave',
          falta: 'ANTHROPIC_API_KEY',
        },
        503,
      );
    }

    const cuerpo: unknown = await c.req.json().catch(() => null);
    const leido = z
      .object({
        pregunta: z.string().trim().min(1).max(LARGO_MAXIMO),
        resumen: resumenPublicableSchema,
      })
      .strict()
      .safeParse(cuerpo);
    if (!leido.success) {
      return c.json({ error: 'La consulta no tiene la forma que se espera' }, 400);
    }

    if (!tope.cabe()) {
      return c.json(
        {
          error: `Llegaste al tope de ${String(TOPE_DIARIO)} consultas de hoy`,
          motivo: 'tope-diario',
          tope: TOPE_DIARIO,
        },
        429,
      );
    }

    try {
      const respuesta = await preguntar(leido.data.resumen, leido.data.pregunta);
      tope.contar();
      return c.json({ ...respuesta, costoUsd: costoDe(respuesta.tokens) });
    } catch (error) {
      const motivo = motivoDeError(error);
      observabilidad.captureError(error, { ruta: '/asistente', motivo });
      return c.json({ error: explicacionDe(motivo), motivo }, motivo === 'tasa' ? 429 : 502);
    }
  });
}
