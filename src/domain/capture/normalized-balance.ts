import { z } from 'zod';

/** El saldo de una cuenta tal como lo declara la fuente en un instante. */
export const normalizedBalanceSchema = z.object({
  fuente: z.union([z.literal('nequi'), z.literal('bancolombia')]),
  numero: z.string().min(1),
  nombre: z.string(),
  moneda: z.literal('COP'),
  /** Entero en la unidad mínima. Se trunca lo que el portal traiga de más. */
  saldo: z.number().int(),
});

export type NormalizedBalance = z.infer<typeof normalizedBalanceSchema>;
