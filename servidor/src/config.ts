import { z } from 'zod';

/**
 * Toda la configuración del servidor, en un sitio y validada al arrancar.
 *
 * Nada de valores por defecto para los secretos: un defecto para una clave de
 * cifrado es cómo se acaba cifrando media vida financiera con «changeme».
 */
const esquema = z.object({
  DATABASE_URL: z.string().min(1, 'la cadena de conexión a Postgres'),
  SERENO_TOKEN: z.string().min(24, 'el token de la app, de al menos 24 caracteres'),
  SERENO_CLAVE_CIFRADO: z
    .string()
    .refine(
      (v) => Buffer.from(v, 'base64').length === 32,
      'la clave de cifrado, 32 bytes en base64',
    ),
  PORT: z.coerce.number().int().positive().default(8080),
  SERENO_INTERVALO_MINUTOS: z.coerce.number().int().positive().max(1440).default(10),

  IMAP_HOST: z.string().min(1),
  IMAP_PUERTO: z.coerce.number().int().positive().default(993),
  IMAP_USUARIO: z.string().min(1),
  IMAP_CLAVE: z.string().min(1),
  IMAP_BUZON: z.string().min(1).default('INBOX'),

  SERENO_GOOGLE_ID: z.string().optional(),
  SERENO_GOOGLE_SECRET: z.string().optional(),
  SERENO_GMAIL_REFRESH_TOKEN: z.string().optional(),
});

export interface Config {
  baseDeDatos: string;
  token: string;
  claveCifrado: Buffer;
  puerto: number;
  intervaloMinutos: number;
  imap: { host: string; puerto: number; usuario: string; clave: string; buzon: string };
  gmail: { clienteId: string; clienteSecreto: string; tokenRefresco: string } | null;
}

/**
 * Lo de Gmail, solo si está completo. A medias no sirve: usar la mitad de
 * unas credenciales es un fallo en la primera petición, y adivinar el resto
 * es peor.
 */
function gmailDesde(v: z.infer<typeof esquema>): Config['gmail'] {
  const id = v.SERENO_GOOGLE_ID;
  const secreto = v.SERENO_GOOGLE_SECRET;
  const token = v.SERENO_GMAIL_REFRESH_TOKEN;
  if (id === undefined || secreto === undefined || token === undefined) return null;
  return { clienteId: id, clienteSecreto: secreto, tokenRefresco: token };
}

/**
 * Lee y valida. Si algo falta, lanza con **todo** lo que falta y sin repetir
 * el valor de ningún secreto: estos mensajes acaban en registros.
 */
export function leerConfig(entorno: Record<string, string | undefined>): Config {
  const resultado = esquema.safeParse(entorno);
  if (!resultado.success) {
    const faltan = resultado.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`La configuración no sirve:\n  ${faltan}`);
  }
  const v = resultado.data;
  return {
    baseDeDatos: v.DATABASE_URL,
    token: v.SERENO_TOKEN,
    claveCifrado: Buffer.from(v.SERENO_CLAVE_CIFRADO, 'base64'),
    puerto: v.PORT,
    intervaloMinutos: v.SERENO_INTERVALO_MINUTOS,
    imap: {
      host: v.IMAP_HOST,
      puerto: v.IMAP_PUERTO,
      usuario: v.IMAP_USUARIO,
      clave: v.IMAP_CLAVE,
      buzon: v.IMAP_BUZON,
    },
    gmail: gmailDesde(v),
  };
}
