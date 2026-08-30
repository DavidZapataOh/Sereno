import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';

import type { MailCursor, MailSource, RawMessage } from '@/domain/mail/message';
import { direccionDe, esRemitenteConocido } from '@/domain/mail/senders';

import { formatearCursorImap, parsearCursorImap, rangoDesde } from './imap-cursor';

export interface ConfigImap {
  host: string;
  puerto: number;
  usuario: string;
  /** Contraseña de aplicación, nunca la del correo. */
  clave: string;
  buzon: string;
}

/** `simpleParser` tiene una sobrecarga con callback; esta fija la de promesa. */
function parsearMime(fuente: Buffer): Promise<ParsedMail> {
  return simpleParser(fuente);
}

/** De un correo ya parseado al mensaje del dominio. */
export function mensajeDesde(uid: number, correo: ParsedMail): RawMessage {
  return {
    id: String(uid),
    remitente: direccionDe(correo.from?.text ?? ''),
    asunto: correo.subject ?? '',
    recibidoEn: (correo.date ?? new Date()).toISOString(),
    // `text` lo deriva mailparser del HTML cuando el correo no trae versión
    // de texto: un banco que solo manda HTML no se queda sin cuerpo.
    texto: correo.text ?? '',
    html: typeof correo.html === 'string' ? correo.html : null,
  };
}

/**
 * Lee el buzón por IMAP, en solo lectura y desde el último UID visto.
 *
 * Se conecta y se desconecta en cada pasada: la ingesta corre cada pocos
 * minutos, y una conexión viva durante horas es una conexión que se cae sin
 * que nadie se entere.
 */
export function crearFuenteImap(config: ConfigImap): MailSource {
  return {
    id: 'imap',
    buscar: async (desde: MailCursor | null, limite: number) => {
      const cliente = new ImapFlow({
        host: config.host,
        port: config.puerto,
        secure: true,
        auth: { user: config.usuario, pass: config.clave },
        logger: false,
      });
      await cliente.connect();
      try {
        // Solo lectura: este proceso no puede marcar, mover ni borrar nada.
        const buzon = await cliente.mailboxOpen(config.buzon, { readOnly: true });
        const validezActual = Number(buzon.uidValidity);
        const anterior = parsearCursorImap(desde?.valor ?? null);
        const rango = rangoDesde(anterior, validezActual);

        const mensajes: RawMessage[] = [];
        let ultimoUid = anterior?.uidValidity === validezActual ? anterior.ultimoUid : 0;

        for await (const sobre of cliente.fetch(
          rango,
          { uid: true, envelope: true, source: true },
          { uid: true },
        )) {
          ultimoUid = Math.max(ultimoUid, sobre.uid);
          // El filtro va antes de parsear: lo que no es del banco no se abre.
          if (!esRemitenteConocido(sobre.envelope?.from?.[0]?.address ?? '')) continue;
          // `source` solo falta si el servidor no lo mandó pese a pedirlo; sin
          // cuerpo no hay nada que leer, y saltarlo es mejor que reventar el
          // lote entero por un correo.
          if (sobre.source === undefined) continue;
          mensajes.push(mensajeDesde(sobre.uid, await parsearMime(sobre.source)));
          if (mensajes.length >= limite) break;
        }

        return {
          mensajes,
          cursor: {
            tipo: 'imap' as const,
            valor: formatearCursorImap({ uidValidity: validezActual, ultimoUid }),
          },
        };
      } finally {
        await cliente.logout();
      }
    },
  };
}
