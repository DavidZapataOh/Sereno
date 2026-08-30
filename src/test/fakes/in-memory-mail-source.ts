import type { MailCursor, MailSource, RawMessage } from '@/domain/mail/message';

export interface InMemoryMailSource extends MailSource {
  /** Cuántas veces se pidió, para comprobar que la ingesta no vuelve al principio. */
  peticiones: () => number;
}

/**
 * Doble del puerto de correo. El cursor es el índice del último mensaje
 * entregado, en texto: suficiente para probar que la ingesta avanza.
 */
export function createInMemoryMailSource(mensajes: readonly RawMessage[]): InMemoryMailSource {
  let peticiones = 0;
  return {
    id: 'imap',
    peticiones: () => peticiones,
    buscar: (desde: MailCursor | null, limite: number) => {
      peticiones += 1;
      const inicio = desde === null ? 0 : Number(desde.valor);
      const pagina = mensajes.slice(inicio, inicio + limite);
      return Promise.resolve({
        mensajes: [...pagina],
        cursor: { tipo: 'imap' as const, valor: String(inicio + pagina.length) },
      });
    },
  };
}
