import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import type { RawMessage } from '@/domain/mail/message';
import { dominioDe } from '@/domain/mail/senders';
import type { SourceId } from '@/domain/sources/registry';

import { bancolombiaParser } from './bancolombia';
import { nequiParser } from './nequi';
import { nuParser } from './nu';
import { rappicardParser } from './rappicard';

/**
 * Un emisor y cómo se le lee.
 *
 * `reconoce` decide si este correo **es una transacción**; que el remitente
 * sea suyo no basta: los bancos mandan también publicidad y avisos.
 * `extraer` lanza si el formato cambió: es preferible una alarma a un
 * movimiento inventado.
 */
export interface MailParser {
  id: SourceId;
  dominios: readonly string[];
  reconoce: (m: RawMessage) => boolean;
  extraer: (m: RawMessage) => NormalizedTransaction[];
}

export type ResultadoParseo =
  | { estado: 'parseado'; fuente: SourceId; movimientos: NormalizedTransaction[] }
  | { estado: 'ignorado'; fuente: SourceId }
  | { estado: 'desconocido' }
  | { estado: 'error'; fuente: SourceId; motivo: string };

export const PARSERS: readonly MailParser[] = [
  bancolombiaParser,
  nequiParser,
  nuParser,
  rappicardParser,
];

export function parserPara(m: RawMessage): MailParser | null {
  const dominio = dominioDe(m.remitente);
  if (dominio.length === 0 || !dominio.includes('.')) return null;
  return (
    PARSERS.find((p) => p.dominios.some((d) => dominio === d || dominio.endsWith(`.${d}`))) ?? null
  );
}

/**
 * Referencia estable de un movimiento sacado de un correo.
 *
 * Si el banco da la suya —número de autorización—, se usa: es la misma que
 * trae la captura web, así que el id determinista coincide y la misma compra
 * vista por los dos canales entra una sola vez, sin depender de la huella.
 * Si no, se deriva del id del correo, que tampoco cambia entre lecturas.
 */
export function referenciaDe(m: RawMessage, indice: number, propia: string | null): string {
  if (propia !== null && propia.trim().length > 0) return propia.trim();
  return indice === 0 ? `correo:${m.id}` : `correo:${m.id}#${String(indice)}`;
}

export function parseMessage(m: RawMessage): ResultadoParseo {
  const parser = parserPara(m);
  if (parser === null) return { estado: 'desconocido' };
  if (!parser.reconoce(m)) return { estado: 'ignorado', fuente: parser.id };
  try {
    const movimientos = parser.extraer(m);
    return movimientos.length === 0
      ? { estado: 'ignorado', fuente: parser.id }
      : { estado: 'parseado', fuente: parser.id, movimientos };
  } catch (error) {
    // El motivo va al registro y a la cola de revisión: no puede arrastrar el
    // cuerpo del correo, que es dato bancario.
    return {
      estado: 'error',
      fuente: parser.id,
      motivo: error instanceof Error ? error.message : String(error),
    };
  }
}
