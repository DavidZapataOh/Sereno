import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';

import type { MailCursor, MailSource, RawMessage } from '@/domain/mail/message';
import { direccionDe, esRemitenteConocido } from '@/domain/mail/senders';

import { criteriosDe, cursorTras } from './imap-busqueda';
import { formatearCursorImap, parsearCursorImap } from './imap-cursor';

export interface ConfigImap {
  host: string;
  puerto: number;
  usuario: string;
  /** Contraseña de aplicación, nunca la del correo. */
  clave: string;
  buzon: string;
  /** Cuántos días atrás mira la primera pasada, cuando aún no hay cursor. */
  diasIniciales: number;
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
 * El filtro por remitente lo hace el servidor de correo, no nosotros: pedir
 * todo y descartar después obliga a descargar el buzón entero. En uno de años
 * eso no es «lento», es una pasada que no termina —y la primera corrida en
 * Railway se quedó colgada así (sprint 06, hallazgo 15)—.
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
        const uidNext = typeof buzon.uidNext === 'number' ? buzon.uidNext : null;
        const anterior = parsearCursorImap(desde?.valor ?? null);
        const mismoBuzon = anterior?.uidValidity === validezActual;

        const encontrados = await cliente.search(
          criteriosDe(anterior, validezActual, new Date(), config.diasIniciales),
          { uid: true },
        );
        // `search` devuelve `false` si el servidor rechaza la búsqueda. Traer
        // el buzón entero «por si acaso» sería justo el fallo que esto arregla.
        const uids = (encontrados === false ? [] : encontrados).slice().sort((a, b) => a - b);
        const aLeer = uids.slice(0, limite);

        const mensajes: RawMessage[] = [];
        const leidos: number[] = [];
        if (aLeer.length > 0) {
          for await (const sobre of cliente.fetch(
            aLeer,
            { uid: true, envelope: true, source: true },
            { uid: true },
          )) {
            leidos.push(sobre.uid);
            // El servidor ya filtró, pero su `FROM` compara por texto suelto.
            // Esta es la comprobación que entiende de dominios.
            if (!esRemitenteConocido(sobre.envelope?.from?.[0]?.address ?? '')) continue;
            // `source` solo falta si el servidor no lo mandó pese a pedirlo; sin
            // cuerpo no hay nada que leer, y saltarlo es mejor que reventar el
            // lote entero por un correo.
            if (sobre.source === undefined) continue;
            mensajes.push(mensajeDesde(sobre.uid, await parsearMime(sobre.source)));
          }
        }

        return {
          mensajes,
          cursor: {
            tipo: 'imap' as const,
            valor: formatearCursorImap({
              uidValidity: validezActual,
              ultimoUid: cursorTras({
                encontrados: uids.length,
                leidos,
                uidNext,
                anteriorUltimoUid: mismoBuzon ? anterior.ultimoUid : 0,
              }),
            }),
          },
        };
      } finally {
        await cliente.logout();
      }
    },
  };
}
