import { z } from 'zod';

export const CAPTURE_PROTOCOL_VERSION = 1;

/**
 * Límite conservador por mensaje de `postMessage`.
 *
 * El puente entre WebView y React Native serializa a texto y tiene un techo
 * práctico. Partir en 64 KB deja margen para el resto del sobre JSON.
 */
export const MAX_FRAGMENT_BYTES = 64 * 1024;

const captureMetaSchema = z.object({
  type: z.literal('sereno:meta'),
  v: z.literal(CAPTURE_PROTOCOL_VERSION),
  id: z.string().min(1),
  url: z.string().min(1),
  method: z.string().min(1),
  status: z.number().int(),
  contentType: z.string(),
  kind: z.union([z.literal('fetch'), z.literal('xhr')]),
  capturedAt: z.string().min(1),
  totalFragments: z.number().int().nonnegative(),
});

const captureFragmentSchema = z.object({
  type: z.literal('sereno:fragment'),
  v: z.literal(CAPTURE_PROTOCOL_VERSION),
  id: z.string().min(1),
  seq: z.number().int().nonnegative(),
  data: z.string(),
});

export const serenoMessageSchema = z.union([captureMetaSchema, captureFragmentSchema]);

export type CaptureKind = z.infer<typeof captureMetaSchema>['kind'];
export type CaptureMeta = z.infer<typeof captureMetaSchema>;
export type CaptureFragment = z.infer<typeof captureFragmentSchema>;
export type SerenoMessage = z.infer<typeof serenoMessageSchema>;

/**
 * Convierte el texto crudo que llega de la WebView en un mensaje válido.
 *
 * Devuelve `null` ante cualquier entrada que no cumpla el contrato. La WebView
 * ejecuta código de un tercero y nunca debe poder tumbar la aplicación con un
 * mensaje mal formado.
 */
export function parseSerenoMessage(raw: string): SerenoMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = serenoMessageSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/** Parte un cuerpo en fragmentos transmisibles. Siempre devuelve al menos uno. */
export function splitIntoFragments(id: string, body: string): CaptureFragment[] {
  const total = Math.max(1, Math.ceil(body.length / MAX_FRAGMENT_BYTES));
  return Array.from({ length: total }, (_, seq) => ({
    type: 'sereno:fragment' as const,
    v: CAPTURE_PROTOCOL_VERSION,
    id,
    seq,
    data: body.slice(seq * MAX_FRAGMENT_BYTES, (seq + 1) * MAX_FRAGMENT_BYTES),
  }));
}
