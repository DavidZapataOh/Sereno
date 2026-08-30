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

export interface ServerClient {
  traer: (desde: number, limite: number) => Promise<ServerPage>;
  confirmar: (cursor: number) => Promise<void>;
}

/** Dónde va el dispositivo y cuándo fue la última vez. */
export interface SyncStateRepository {
  leerCursor: () => Promise<number>;
  escribirCursor: (valor: number) => Promise<void>;
  ultimaTraida: () => Promise<string | null>;
  marcarTraida: (iso: string) => Promise<void>;
}
