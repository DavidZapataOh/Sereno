import { serverPageSchema, type ServerClient } from '@/domain/sync/server-client';

export interface ConfigServidor {
  url: string;
  token: string;
}

/**
 * El servidor, por HTTP.
 *
 * La respuesta se valida con el esquema del dominio antes de devolverla: lo
 * que llega por red es dato externo, aunque el servidor sea nuestro.
 */
export function createHttpServerClient(config: ConfigServidor): ServerClient {
  const cabeceras = { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' };
  const base = config.url.replace(/\/+$/, '');

  return {
    traer: async (desde, limite) => {
      const respuesta = await fetch(
        `${base}/movimientos?desde=${String(desde)}&limite=${String(limite)}`,
        { headers: cabeceras },
      );
      if (!respuesta.ok) throw new Error(`El servidor respondió ${String(respuesta.status)}`);
      return serverPageSchema.parse(await respuesta.json());
    },

    confirmar: async (cursor) => {
      const respuesta = await fetch(`${base}/confirmaciones`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify({ cursor }),
      });
      if (!respuesta.ok) throw new Error(`El servidor respondió ${String(respuesta.status)}`);
    },
  };
}

/**
 * El cliente cuando no hay servidor configurado.
 *
 * La app tiene que seguir funcionando exactamente igual que antes del sprint
 * 06 si David no ha desplegado nada: lo de SQLite se ve, y la traída
 * simplemente no ocurre.
 */
export function createSinServidor(): ServerClient {
  return {
    traer: () => Promise.reject(new Error('Sin servidor configurado')),
    confirmar: () => Promise.reject(new Error('Sin servidor configurado')),
  };
}
