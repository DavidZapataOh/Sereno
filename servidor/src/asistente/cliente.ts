import Anthropic from '@anthropic-ai/sdk';

import { cifrasDe, mensajeDe, sinLaLineaDeCifras, SISTEMA } from './prompt';

/**
 * El modelo y su coste, declarados.
 *
 * Es dinero real del usuario por una función accesoria: la cifra se cuenta y se
 * enseña. Comprobado contra la referencia de la API el 2026-09-01.
 */
export const MODELO = 'claude-opus-5';
export const USD_POR_MILLON_ENTRADA = 5;
export const USD_POR_MILLON_SALIDA = 25;

/** Una respuesta corta: no hace falta más techo, y menos trunca a media frase. */
const MAX_TOKENS = 2000;

export interface RespuestaAsistente {
  respuesta: string;
  /** Qué cifras dijo haber usado. Sin esto la respuesta es un oráculo. */
  cifrasUsadas: string[];
  tokens: { entrada: number; salida: number };
}

export type ClienteAsistente = ReturnType<typeof crearClienteAsistente>;

/**
 * El asistente, en el servidor.
 *
 * **La clave vive aquí**, como la contraseña del correo desde el sprint 06 y la
 * de Binance desde el 08: el teléfono no guarda credenciales que cuesten dinero.
 *
 * `thinking: { type: 'adaptive' }` y **sin `budget_tokens`**: ese parámetro está
 * eliminado en este modelo y mandarlo devuelve un 400. Se comprobó contra la
 * referencia antes de escribirlo, no de memoria.
 */
export function crearClienteAsistente(clave: string, sdk?: Anthropic) {
  const cliente = sdk ?? new Anthropic({ apiKey: clave });

  return {
    preguntar: async (resumen: unknown, pregunta: string): Promise<RespuestaAsistente> => {
      const respuesta = await cliente.messages.create({
        model: MODELO,
        max_tokens: MAX_TOKENS,
        system: SISTEMA,
        thinking: { type: 'adaptive' },
        // Una consulta corta sobre unas pocas cifras: no hace falta más.
        output_config: { effort: 'low' },
        messages: [{ role: 'user', content: mensajeDe(resumen, pregunta) }],
      });

      const texto = respuesta.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      return {
        respuesta: sinLaLineaDeCifras(texto),
        cifrasUsadas: cifrasDe(texto),
        tokens: {
          entrada: respuesta.usage.input_tokens,
          salida: respuesta.usage.output_tokens,
        },
      };
    },
  };
}

/**
 * Por qué falló, según las clases del SDK.
 *
 * **Nunca comparando cadenas**: los mensajes de la API cambian sin avisar y
 * traducidos no coinciden con nada. El SDK trae clases tipadas justo para esto.
 */
export type MotivoDeFallo = 'tasa' | 'credenciales' | 'peticion' | 'servicio' | 'desconocido';

export function motivoDeError(error: unknown): MotivoDeFallo {
  if (error instanceof Anthropic.RateLimitError) return 'tasa';
  if (error instanceof Anthropic.AuthenticationError) return 'credenciales';
  if (error instanceof Anthropic.BadRequestError) return 'peticion';
  if (error instanceof Anthropic.APIError) return 'servicio';
  return 'desconocido';
}

/**
 * Lo que se le puede decir a quien pregunta, sin repetir nada del error.
 *
 * Un mensaje de la API puede llevar la cabecera que se mandó, y ahí va la
 * clave. Lo que se responde es una frase de esta lista y nunca el error.
 */
export function explicacionDe(motivo: MotivoDeFallo): string {
  switch (motivo) {
    case 'tasa':
      return 'El asistente está saturado ahora mismo. Intenta en un minuto.';
    case 'credenciales':
      return 'La clave del asistente no sirve. Hay que revisarla en el servidor.';
    case 'peticion':
      return 'La consulta no se pudo enviar como estaba.';
    case 'servicio':
    case 'desconocido':
      return 'El asistente no pudo responder.';
  }
}

/** Lo que costó una consulta, en dólares. Se enseña: es plata del usuario. */
export function costoDe(tokens: { entrada: number; salida: number }): number {
  return (
    (tokens.entrada * USD_POR_MILLON_ENTRADA) / 1_000_000 +
    (tokens.salida * USD_POR_MILLON_SALIDA) / 1_000_000
  );
}
