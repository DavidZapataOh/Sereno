import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { cuerpoDe, fechaColombiana, montoColombiano } from '@/domain/mail/extraccion';
import type { RawMessage } from '@/domain/mail/message';

import { referenciaDe, type MailParser } from './parser';

const VERBOS = /\b(pagaste|hiciste un pago|recibiste)\b/i;

/** `Código de autorización: V260705.0504.230013` o `CUS: 557495005`. */
const REFERENCIA = /(?:c[oó]digo de autorizaci[oó]n|cus)\s*:?\s*([\w.]+)/i;
/** El comercio de una factura está en el ASUNTO: «Comprobante de Pago Claro». */
const COMERCIO_DEL_ASUNTO = /comprobante de pago\s+(.+)/i;

const FORMAS: {
  patron: RegExp;
  tipo: 'debito' | 'credito';
  descripcion: (m: RegExpExecArray, correo: RawMessage) => string;
}[] = [
  {
    patron: /pagaste con nequi tu factura por/i,
    tipo: 'debito',
    descripcion: (_, correo) => COMERCIO_DEL_ASUNTO.exec(correo.asunto)?.[1]?.trim() ?? 'Factura',
  },
  {
    patron: /hiciste un pago en\s+(.+?)\s+por\s+\$?[\d.,]+/i,
    tipo: 'debito',
    descripcion: (m) => m[1] ?? '',
  },
  {
    patron: /recibiste\s+\$?[\d.,]+\s+de\s+(.+?)\s+el\s+\d/i,
    tipo: 'credito',
    descripcion: (m) => m[1] ?? '',
  },
];

/**
 * Nequi.
 *
 * **Solo manda correo de una parte de los movimientos**: facturas, pagos a
 * comercios y lo recibido por Bre-B. Las transferencias normales, el QR y la
 * tarjeta no llegan por aquí (ver la tabla de cobertura del sprint 06). Eso no
 * lo arregla un parser.
 */
export const nequiParser: MailParser = {
  id: 'nequi',
  dominios: ['nequi.com.co'],

  // Más ancho que `FORMAS` a propósito: un formato cambiado debe fallar en
  // `extraer` y acabar en revisión, no irse a «ignorado» sin que nadie lo vea.
  reconoce: (m) => VERBOS.test(cuerpoDe(m)),

  extraer: (m: RawMessage): NormalizedTransaction[] => {
    const cuerpo = cuerpoDe(m);
    for (const forma of FORMAS) {
      const encontrado = forma.patron.exec(cuerpo);
      if (encontrado === null) continue;
      const desde = cuerpo.slice(encontrado.index);
      const monto = montoColombiano(desde);
      if (monto === null) throw new Error('Correo de Nequi sin monto legible');
      return [
        {
          fecha: fechaColombiana(desde) ?? m.recibidoEn,
          descripcion: forma.descripcion(encontrado, m).trim(),
          monto,
          moneda: 'COP',
          tipo: forma.tipo,
          fuente: 'nequi',
          referencia: referenciaDe(m, 0, REFERENCIA.exec(cuerpo)?.[1] ?? null),
        },
      ];
    }
    throw new Error('Correo de Nequi con una plantilla no reconocida');
  },
};
