import { z } from 'zod';

/**
 * Modelo común de la fase de captura.
 *
 * El monto es SIEMPRE positivo: la dirección del dinero vive en `tipo`. Permitir
 * montos negativos junto a un campo de tipo crea dos fuentes de verdad para el
 * mismo hecho, y tarde o temprano se contradicen.
 */
export const normalizedTransactionSchema = z.object({
  fecha: z.string().min(1),
  descripcion: z.string(),
  monto: z.number().int().nonnegative(),
  moneda: z.literal('COP'),
  tipo: z.union([z.literal('debito'), z.literal('credito')]),
  fuente: z.union([z.literal('nequi'), z.literal('bancolombia')]),
  referencia: z.string().nullable(),
});

export type NormalizedTransaction = z.infer<typeof normalizedTransactionSchema>;
