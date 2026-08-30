/**
 * Un correo tal como llegó, ya reducido a lo que hace falta para leerlo.
 *
 * `id` es estable en su origen: el UID de IMAP o el id de Gmail. Es lo que
 * permite no volver a bajar lo mismo y lo que ata cada movimiento al correo
 * del que salió.
 */
export interface RawMessage {
  id: string;
  remitente: string;
  asunto: string;
  /** ISO 8601 con zona. */
  recibidoEn: string;
  texto: string;
  html: string | null;
}

/** Por dónde va la lectura. Su contenido solo lo entiende su adaptador. */
export interface MailCursor {
  tipo: 'imap' | 'gmail';
  valor: string;
}

/**
 * De dónde salen los correos. Dos adaptadores lo implementan; el ciclo de
 * ingesta no sabe cuál está usando.
 */
export interface MailSource {
  id: 'imap' | 'gmail';
  buscar: (
    desde: MailCursor | null,
    limite: number,
  ) => Promise<{ mensajes: RawMessage[]; cursor: MailCursor }>;
}
