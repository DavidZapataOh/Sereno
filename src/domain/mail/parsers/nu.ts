import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { cuerpoDe, fechaColombiana, montoColombiano } from '@/domain/mail/extraccion';
import type { RawMessage } from '@/domain/mail/message';

import { referenciaDe, type MailParser } from './parser';

const PAGO = /recibimos el pago que hiciste de tu tarjeta/i;
/** Más ancho que `PAGO`: un formato cambiado va a revisión, no al olvido. */
const PARECE_PAGO = /recibimos (el|tu) pago|tu pago fue de/i;
const MONTO = /tu pago fue de\s+(\$?[\d.,]+)/is;
const FECHA = /lo has realizado el\s+(.+?)\s+tipo de transacci[oó]n/is;
const ID = /id transacci[oó]n\s+([0-9a-f-]{36})/is;

/**
 * Nu.
 *
 * **No manda correo de ninguna compra**: solo del pago de la cuota. Lo que se
 * compra con la tarjeta llega por notificación push, que es el sprint 06b.
 *
 * Un pago a la tarjeta es un `credito` en la convención de la app: el apunte
 * positivo va a la cuenta de la fuente, y en un pasivo eso es «debe menos».
 */
export const nuParser: MailParser = {
  id: 'nu',
  dominios: ['nu.com.co', 'nubank.com.co'],

  reconoce: (m) => PARECE_PAGO.test(cuerpoDe(m)),

  extraer: (m: RawMessage): NormalizedTransaction[] => {
    const cuerpo = cuerpoDe(m);
    if (!PAGO.test(cuerpo)) throw new Error('Correo de Nu con una plantilla no reconocida');
    const monto = montoColombiano(MONTO.exec(cuerpo)?.[1] ?? '');
    if (monto === null) throw new Error('Correo de Nu sin monto legible');
    return [
      {
        fecha: fechaColombiana(FECHA.exec(cuerpo)?.[1] ?? '') ?? m.recibidoEn,
        descripcion: 'Pago de la tarjeta',
        monto,
        moneda: 'COP',
        tipo: 'credito',
        fuente: 'nu',
        referencia: referenciaDe(m, 0, ID.exec(cuerpo)?.[1] ?? null),
      },
    ];
  },
};
