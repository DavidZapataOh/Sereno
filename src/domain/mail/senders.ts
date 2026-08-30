/**
 * De quién aceptamos correo. Todo lo demás ni se descarga entero: se descarta
 * por la cabecera. Es la primera línea contra un correo falso que imite una
 * alerta bancaria.
 */
export const REMITENTES: readonly { dominio: string; fuente: string }[] = [
  // OJO: las alertas NO vienen de bancolombia.com.co. Vienen de
  // `alertasynotificaciones@an.notificacionesbancolombia.com` y del subdominio
  // `ayn.`. Filtrar por el dominio de la marca las descartaría todas, en
  // silencio. Lo destaparon los correos reales de David (sprint 06, hallazgo 1).
  { dominio: 'notificacionesbancolombia.com', fuente: 'bancolombia' },
  { dominio: 'bancolombia.com.co', fuente: 'bancolombia' },
  { dominio: 'grupobancolombia.com', fuente: 'bancolombia' },
  { dominio: 'nequi.com.co', fuente: 'nequi' },
  { dominio: 'nu.com.co', fuente: 'nu' },
  { dominio: 'nubank.com.co', fuente: 'nu' },
  { dominio: 'rappicard.co', fuente: 'rappicard' },
  { dominio: 'rappi.com', fuente: 'rappicard' },
];

/** La dirección de «Nombre <buzón@dominio>», o la cadena entera si no viene así. */
export function direccionDe(remitente: string): string {
  const entre = /<([^>]+)>/.exec(remitente);
  return (entre?.[1] ?? remitente).trim().toLowerCase();
}

export function dominioDe(remitente: string): string {
  return direccionDe(remitente).split('@').at(-1) ?? '';
}

/**
 * Compara el dominio **entero**, no por sufijo de cadena:
 * `notificacionesbancolombia.com.otro.net` termina en nuestro dominio y no es
 * nuestro. Los subdominios sí valen: `an.` y `ayn.` son los que usa el banco.
 */
export function esRemitenteConocido(remitente: string): boolean {
  const dominio = dominioDe(remitente);
  if (dominio.length === 0 || !dominio.includes('.')) return false;
  return REMITENTES.some((r) => dominio === r.dominio || dominio.endsWith(`.${r.dominio}`));
}
