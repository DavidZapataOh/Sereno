import {
  exchangeBalancesSchema,
  serverHealthSchema,
  serverPageSchema,
  type ServerClient,
} from '@/domain/sync/server-client';

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

    salud: async () => {
      const respuesta = await fetch(`${base}/salud`, { headers: cabeceras });
      if (!respuesta.ok) throw new Error(`El servidor respondió ${String(respuesta.status)}`);
      return serverHealthSchema.parse(await respuesta.json());
    },

    saldos: async () => {
      try {
        const respuesta = await fetch(`${base}/saldos`, { headers: cabeceras });
        // 503 es «no hay claves en el servidor», que no es un fallo: es un
        // estado que el usuario puede arreglar, y la pantalla lo dice así.
        if (respuesta.status === 503) return { estado: 'sin-configurar' };
        if (!respuesta.ok) {
          return { estado: 'error', motivo: `El servidor respondió ${String(respuesta.status)}` };
        }
        // Nunca una lista vacía por un fallo: significaría «no tienes nada» y
        // borraría el saldo de la pantalla.
        return {
          estado: 'ok',
          saldos: exchangeBalancesSchema.parse(await respuesta.json()).saldos,
        };
      } catch (error) {
        return { estado: 'error', motivo: error instanceof Error ? error.message : String(error) };
      }
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
    salud: () => Promise.reject(new Error('Sin servidor configurado')),
    saldos: () => Promise.resolve({ estado: 'sin-configurar' as const }),
  };
}
