import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { cuerpoDe, fechaColombiana, montoColombiano } from '@/domain/mail/extraccion';
import type { RawMessage } from '@/domain/mail/message';

import { referenciaDe, type MailParser } from './parser';

const COMPRA = /realizaste una compra con tu rappicard/i;
const PAGO = /recibimos el pago de tu tarjeta/i;
const MONTO = /monto\s+(\$?[\d.,]+)/is;
// `s`: en el correo real la etiqueta y su valor van en líneas distintas,
// y sin la bandera `.` no cruza el salto. Se veía como «comercio perdido».
const COMERCIO = /comercio\s+(.+?)\s+fecha/is;
const FECHA_COMPRA = /fecha de la transacci[oó]n\s+([\d-]+\s+[\d:]+)/is;
const FECHA_PAGO = /fecha y hora\s+(.+?)\s+m[eé]todo/is;
const AUTORIZACION = /no\.?\s*de autorizaci[oó]n\s+(\w+)/is;
const PARECE_MOVIMIENTO =
  /realizaste una compra|recibimos el pago|resumen de transacci[oó]n|comprobante de pago/i;

/**
 * RappiCard. Manda correo de las compras **y** de los pagos.
 *
 * Un pago a la tarjeta es un `credito`: reduce la deuda del pasivo.
 */
export const rappicardParser: MailParser = {
  id: 'rappicard',
  dominios: ['rappicard.co', 'rappi.com'],

  // Más ancho que `COMPRA`/`PAGO`: un formato cambiado va a revisión.
  reconoce: (m) => PARECE_MOVIMIENTO.test(`${m.asunto} ${cuerpoDe(m)}`),

  extraer: (m: RawMessage): NormalizedTransaction[] => {
    const cuerpo = cuerpoDe(m);
    const esCompra = COMPRA.test(cuerpo);
    if (!esCompra && !PAGO.test(cuerpo)) {
      throw new Error('Correo de RappiCard con una plantilla no reconocida');
    }
    const monto = montoColombiano(MONTO.exec(cuerpo)?.[1] ?? '');
    if (monto === null) throw new Error('Correo de RappiCard sin monto legible');

    const fechaCruda = esCompra
      ? (FECHA_COMPRA.exec(cuerpo)?.[1] ?? '')
      : (FECHA_PAGO.exec(cuerpo)?.[1] ?? '');

    return [
      {
        fecha: fechaColombiana(fechaCruda) ?? m.recibidoEn,
        descripcion: esCompra
          ? (COMERCIO.exec(cuerpo)?.[1]?.trim() ?? 'Compra con RappiCard')
          : 'Pago de la tarjeta',
        monto,
        moneda: 'COP',
        tipo: esCompra ? 'debito' : 'credito',
        fuente: 'rappicard',
        referencia: referenciaDe(m, 0, AUTORIZACION.exec(cuerpo)?.[1] ?? null),
      },
    ];
  },
};
