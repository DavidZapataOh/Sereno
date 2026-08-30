import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const VERSION = 'v1';

/** La clave de cifrado, desde su forma en base64 del entorno. */
export function claveDesde(base64: string): Buffer {
  const clave = Buffer.from(base64, 'base64');
  if (clave.length !== 32) {
    throw new Error(`La clave de cifrado debe medir 32 bytes y mide ${String(clave.length)}`);
  }
  return clave;
}

/**
 * Cifra con AES-256-GCM.
 *
 * El cuerpo de un correo bancario trae comercio, monto y los últimos dígitos
 * de la tarjeta, y la base vive en un servicio de terceros. El resultado
 * lleva versión para poder cambiar de algoritmo dentro de unos años sin
 * tener que adivinar qué es cada fila.
 */
export function cifrar(texto: string, clave: Buffer): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv(ALGORITMO, clave, iv);
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return [
    VERSION,
    iv.toString('base64url'),
    cifrador.getAuthTag().toString('base64url'),
    datos.toString('base64url'),
  ].join('.');
}

export function descifrar(sobre: string, clave: Buffer): string {
  const partes = sobre.split('.');
  const [version, iv, tag, datos] = partes;
  if (
    partes.length !== 4 ||
    version !== VERSION ||
    iv === undefined ||
    tag === undefined ||
    datos === undefined
  ) {
    throw new Error('El sobre cifrado no tiene la forma esperada');
  }
  const descifrador = createDecipheriv(ALGORITMO, clave, Buffer.from(iv, 'base64url'));
  descifrador.setAuthTag(Buffer.from(tag, 'base64url'));
  // `final()` lanza si el contenido fue alterado o la clave no es la suya.
  return Buffer.concat([
    descifrador.update(Buffer.from(datos, 'base64url')),
    descifrador.final(),
  ]).toString('utf8');
}
