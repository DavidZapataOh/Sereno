/**
 * Por dónde nos enteramos de un movimiento.
 *
 * No es lo mismo que la fuente. La **fuente** es de quién es la plata
 * (`bancolombia`, `nu`); el **canal** es cómo llegó la noticia. Una misma
 * fuente puede llegar por varios canales a la vez: Bancolombia se importa del
 * portal *y* manda correo de cada movimiento.
 *
 * El sprint 04 no distinguía las dos cosas, y por eso la identidad de una
 * transacción dentro de una fuente era su referencia. Con dos canales eso deja
 * de valer: el correo no trae el número de autorización del portal, así que la
 * misma compra llegaba con dos referencias distintas y se contaba dos veces.
 * La identidad es por **fuente y canal**, no por fuente.
 */
export type Channel = 'web' | 'correo' | 'notificacion';

/** Fuente y canal juntos: es la unidad de identidad de la deduplicación. */
export function via(fuente: string, canal: Channel): string {
  return `${fuente}:${canal}`;
}
