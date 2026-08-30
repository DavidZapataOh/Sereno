import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { cuerpoDe, fechaColombiana, montoColombiano } from '@/domain/mail/extraccion';
import type { RawMessage } from '@/domain/mail/message';

import { referenciaDe, type MailParser } from './parser';

/**
 * Las ocho plantillas que manda Bancolombia, en orden: la primera que
 * coincide gana, así que las específicas van antes que las generales.
 *
 * El asunto siempre es «Alertas y Notificaciones»: no distingue nada, todo
 * está en el cuerpo. Y los correos **no traen número de autorización**, así
 * que la referencia se deriva del id del mensaje y la deduplicación contra la
 * captura web se apoya en la huella del sprint 04, no en el id.
 */
const FORMAS: {
  patron: RegExp;
  tipo: 'debito' | 'credito';
  descripcion: (m: RegExpExecArray) => string;
}[] = [
  {
    patron: /compraste\s+\$?[\d.,]+\s+en\s+(.+?)\s+con tu/i,
    tipo: 'debito',
    descripcion: (m) => m[1] ?? '',
  },
  {
    patron: /pagaste\s+\$?[\d.,]+\s+por\s+codigo qr\s+.*?a la llave\s+(\S+)/i,
    tipo: 'debito',
    descripcion: (m) => `Pago por QR a la llave ${m[1] ?? ''}`,
  },
  {
    patron: /pagaste\s+\$?[\d.,]+\s+a\s+(.+?)\s+desde/i,
    tipo: 'debito',
    descripcion: (m) => m[1] ?? '',
  },
  {
    patron: /retiraste\s+\$?[\d.,]+\s+en\s+(.+?)\s+de tu/i,
    tipo: 'debito',
    descripcion: (m) => `Retiraste en ${m[1] ?? ''}`,
  },
  {
    patron: /transferiste\s+\$?[\d.,]+\s+desde.*?a la cuenta\s+(\*?\d+)/i,
    tipo: 'debito',
    descripcion: (m) => `Transferencia a la cuenta ${m[1] ?? ''}`,
  },
  {
    patron: /consignacion\s+por\s+\$?[\d.,]+\s+desde el corresponsal\s+(.+?)\s+en\s/i,
    tipo: 'credito',
    descripcion: (m) => m[1] ?? '',
  },
  {
    patron: /transferencia\s+de\s+(.+?)\s+por\s+\$?[\d.,]+/i,
    tipo: 'credito',
    descripcion: (m) => m[1] ?? '',
  },
  {
    patron: /transferencia\s+por\s+\$?[\d.,]+\s+de\s+(.+?)\s+en tu cuenta/i,
    tipo: 'credito',
    descripcion: (m) => m[1] ?? '',
  },
];

/**
 * La línea con la que Bancolombia encabeza **todos** sus correos de
 * movimiento, y los verbos que usa.
 *
 * `reconoce` es a propósito más ancho que `FORMAS`: si el banco cambia una
 * plantilla, el correo tiene que llegar a `extraer` y **fallar ahí**, para
 * acabar en la cola de revisión. Con un `reconoce` estrecho se iría a
 * «ignorado» y nadie se enteraría de que dejamos de leer las compras.
 */
const MARCA = /todo sali[oó] bien con tus movimientos/i;
const VERBOS = /\b(compraste|pagaste|retiraste|transferiste|recibiste|consignacion)\b/i;

export const bancolombiaParser: MailParser = {
  id: 'bancolombia',
  dominios: ['notificacionesbancolombia.com', 'bancolombia.com.co', 'grupobancolombia.com'],

  reconoce: (m) => {
    const cuerpo = cuerpoDe(m);
    return MARCA.test(cuerpo) || VERBOS.test(cuerpo);
  },

  extraer: (m: RawMessage): NormalizedTransaction[] => {
    const cuerpo = cuerpoDe(m);
    for (const forma of FORMAS) {
      const encontrado = forma.patron.exec(cuerpo);
      if (encontrado === null) continue;
      // Desde donde empieza la frase: así el monto y la fecha son los de esta
      // operación y no los de la publicidad que viene debajo.
      const desde = cuerpo.slice(encontrado.index);
      const monto = montoColombiano(desde);
      if (monto === null) throw new Error('Correo de Bancolombia sin monto legible');
      return [
        {
          fecha: fechaColombiana(desde) ?? m.recibidoEn,
          // La descripción cruda es la que el sprint 05 convierte en comercio.
          descripcion: forma.descripcion(encontrado).trim(),
          monto,
          moneda: 'COP',
          tipo: forma.tipo,
          fuente: 'bancolombia',
          referencia: referenciaDe(m, 0, null),
        },
      ];
    }
    throw new Error('Correo de Bancolombia con una plantilla no reconocida');
  },
};
