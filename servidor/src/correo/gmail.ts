import { google } from 'googleapis';

import type { MailCursor, MailSource, RawMessage } from '@/domain/mail/message';
import { direccionDe, REMITENTES } from '@/domain/mail/senders';

import { cabecera, parteDeTexto, type PayloadGmail } from './gmail-payload';

export interface ConfigGmail {
  clienteId: string;
  clienteSecreto: string;
  /** Se obtiene una vez con `scripts/autorizar-gmail.ts`. */
  tokenRefresco: string;
}

/** `from:(a OR b OR …)`: el filtro va en el servidor de Gmail, no aquí. */
const CONSULTA = `from:(${REMITENTES.map((r) => r.dominio).join(' OR ')})`;

/**
 * Lee por la API de Gmail.
 *
 * No es el adaptador que se usa: una app de Google en estado «Testing» caduca
 * su token de refresco a los siete días, y la ingesta se pararía cada semana
 * (ver «Decisiones» en el README del sprint). Queda listo por si algún día
 * conviene mover.
 */
export function crearFuenteGmail(config: ConfigGmail): MailSource {
  const auth = new google.auth.OAuth2(config.clienteId, config.clienteSecreto);
  auth.setCredentials({ refresh_token: config.tokenRefresco });
  const gmail = google.gmail({ version: 'v1', auth });

  return {
    id: 'gmail',
    buscar: async (desde: MailCursor | null, limite: number) => {
      const lista = await gmail.users.messages.list({
        userId: 'me',
        q: CONSULTA,
        maxResults: limite,
      });
      const ids = (lista.data.messages ?? [])
        .map((m) => m.id)
        .filter((id): id is string => typeof id === 'string');

      // El cursor de Gmail es el id del último mensaje ya traído: la lista
      // viene de más nuevo a más viejo, así que se corta ahí en vez de volver
      // a bajarla entera.
      const visto = desde?.valor ?? null;
      const posicion = visto === null ? -1 : ids.indexOf(visto);
      const nuevos = posicion === -1 ? ids : ids.slice(0, posicion);

      const mensajes: RawMessage[] = [];
      for (const id of nuevos) {
        const detalle = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
        const payload = (detalle.data.payload ?? {}) as PayloadGmail;
        const { texto, html } = parteDeTexto(payload);
        mensajes.push({
          id,
          remitente: direccionDe(cabecera(payload, 'From')),
          asunto: cabecera(payload, 'Subject'),
          recibidoEn: new Date(Number(detalle.data.internalDate ?? 0)).toISOString(),
          texto,
          html,
        });
      }

      return { mensajes, cursor: { tipo: 'gmail' as const, valor: ids[0] ?? visto ?? '' } };
    },
  };
}
