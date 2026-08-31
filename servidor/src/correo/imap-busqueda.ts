import { REMITENTES } from '@/domain/mail/senders';

import { type CursorImap, rangoDesde } from './imap-cursor';

/** Lo que se le pasa a IMAP SEARCH. Solo lo que usamos de imapflow. */
export interface Criterios {
  uid: string;
  or: { from: string }[];
  since?: Date;
}

const DIA_EN_MS = 24 * 60 * 60 * 1000;

/**
 * Qué pedirle al servidor de correo.
 *
 * Lo importante es que el filtro por remitente lo haga **el servidor**. Pedir
 * el buzón entero y descartar después significa descargar años de correo
 * personal para quedarse con veinte alertas del banco: en un buzón de verdad
 * eso no es lento, es que no termina.
 *
 * Y la primera pasada se acota por fecha: sin cursor, el rango es «todo», y
 * aquí no interesa el histórico —la app arranca su contabilidad el día que se
 * instala—. Las pasadas siguientes van por UID, que es exacto y barato.
 */
export function criteriosDe(
  anterior: CursorImap | null,
  uidValidityActual: number,
  ahora: Date,
  diasIniciales: number,
): Criterios {
  const uid = rangoDesde(anterior, uidValidityActual);
  const criterios: Criterios = {
    uid,
    or: REMITENTES.map((r) => ({ from: r.dominio })),
  };
  if (uid === '1:*') criterios.since = new Date(ahora.getTime() - diasIniciales * DIA_EN_MS);
  return criterios;
}

/**
 * Hasta dónde puede avanzar el cursor.
 *
 * Si se leyó todo lo que el servidor encontró, el cursor puede saltar al final
 * del buzón: los correos que no coincidieron ya no interesan y volver a
 * mirarlos cada pasada es el mismo trabajo inútil de antes.
 *
 * Si se cortó por el límite, el cursor **no puede pasar del último leído**, o
 * lo que quedó a medias no se vuelve a ver nunca.
 */
export function cursorTras(entrada: {
  encontrados: number;
  leidos: number[];
  uidNext: number | null;
  anteriorUltimoUid: number;
}): number {
  const { encontrados, leidos, uidNext, anteriorUltimoUid } = entrada;
  const mayorLeido = leidos.length > 0 ? Math.max(...leidos) : anteriorUltimoUid;
  if (leidos.length < encontrados) return mayorLeido;
  if (uidNext !== null && uidNext - 1 > mayorLeido) return uidNext - 1;
  return mayorLeido;
}
