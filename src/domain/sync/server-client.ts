import { z } from 'zod';

import { normalizedTransactionSchema } from '@/domain/capture/normalized-transaction';

/** Un movimiento tal como lo entrega el servidor: el del dominio, con su id y su lugar en la fila. */
export const serverMovementSchema = normalizedTransactionSchema.extend({
  id: z.string().min(1),
  secuencia: z.number().int().nonnegative(),
});
export type ServerMovement = z.infer<typeof serverMovementSchema>;

/**
 * La página que entrega el servidor. Se valida entera: una respuesta que no
 * encaje es un error ruidoso, no un `undefined` que acabe en el ledger.
 */
export const serverPageSchema = z.object({
  movimientos: z.array(serverMovementSchema),
  cursor: z.number().int().nonnegative(),
  hayMas: z.boolean(),
});
export type ServerPage = z.infer<typeof serverPageSchema>;

/** Lo que `/salud` cuenta del servidor. */
export const serverHealthSchema = z.object({
  estado: z.string(),
  movimientosPendientes: z.number().int().nonnegative(),
  enRevision: z.number().int().nonnegative(),
  ultimaCorrida: z
    .object({
      iniciadoEn: z.string(),
      terminadoEn: z.string().nullable(),
      error: z.string().nullable(),
    })
    .nullable(),
});
export type ServerHealth = z.infer<typeof serverHealthSchema>;

/**
 * Los saldos del exchange, tal como los entrega el servidor.
 *
 * La cantidad viaja como **texto**: un entero de escala cripto no cabe en un
 * `number` de JSON sin perder dígitos, y perderlos aquí es perder plata.
 */
export const exchangeBalanceSchema = z.object({
  activo: z.string().min(1),
  cantidad: z.string().regex(/^\d+$/, 'La cantidad viene como entero en texto'),
});
export type ExchangeBalance = z.infer<typeof exchangeBalanceSchema>;

export const exchangeBalancesSchema = z.object({ saldos: z.array(exchangeBalanceSchema) });

/**
 * Qué se sabe del exchange. **Tres estados, no dos.**
 *
 * Va como unión y no como excepción a propósito. Cuando esto lanzaba, el
 * llamador podía tragarse el error sin enseñarlo —y eso fue exactamente lo que
 * pasó: las claves no estaban en Railway y la app se quedó muda—. Así el
 * compilador obliga a decidir qué se hace con cada caso.
 *
 * Y «sin configurar» no es «no tienes nada»: son cosas distintas y se ven
 * distintas.
 */
export type ExchangeStatus =
  | { estado: 'ok'; saldos: ExchangeBalance[] }
  | { estado: 'sin-configurar' }
  | { estado: 'error'; motivo: string };

export interface ServerClient {
  traer: (desde: number, limite: number) => Promise<ServerPage>;
  confirmar: (cursor: number) => Promise<void>;
  /** Los saldos del exchange, con su estado. Nunca lanza: los tres casos se declaran. */
  saldos: () => Promise<ExchangeStatus>;
  salud: () => Promise<ServerHealth>;
}

/** Dónde va el dispositivo y cuándo fue la última vez. */
export interface SyncStateRepository {
  leerCursor: () => Promise<number>;
  escribirCursor: (valor: number) => Promise<void>;
  ultimaTraida: () => Promise<string | null>;
  marcarTraida: (iso: string) => Promise<void>;
  /** El día en que este teléfono empezó a escuchar el correo. Se fija una vez. */
  leerInicioCorreo: () => Promise<string | null>;
  escribirInicioCorreo: (dia: string) => Promise<void>;
}
