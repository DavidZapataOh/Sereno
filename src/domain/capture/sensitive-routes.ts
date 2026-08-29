/**
 * Frontera de seguridad de la captura.
 *
 * Decide qué respuestas pueden leerse. Cualquier URL que huela a autenticación
 * queda excluida, para no registrar credenciales ni tokens de sesión.
 *
 * La decisión por defecto es NO capturar: ante cualquier duda se descarta.
 * Perder una respuesta de datos cuesta una iteración; capturar una credencial
 * es un fallo que no se deshace.
 */
export const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /login/i,
  /logon/i,
  /signin/i,
  /signup/i,
  /registro/i,
  /auth/i,
  // Los portales colombianos usan español en sus rutas: «auth» no cubre
  // «autenticacion», y «password» no cubre «contrasena».
  /autentic/i,
  /contrase/i,
  /token/i,
  /session/i,
  /password/i,
  /clave/i,
  /credential/i,
  /otp/i,
  /mfa/i,
  /2fa/i,
  /segundo-factor/i,
  /captcha/i,
  /challenge/i,
];

const MAX_DECODE_PASSES = 3;

/**
 * Decodifica la URL repetidamente para que un escape no oculte un patrón.
 *
 * `%6Cogin` decodifica a `login`, y `%256Cogin` requiere dos pasadas. Se limita
 * el número de pasadas para no quedar en bucle ante una entrada construida a
 * propósito.
 */
function fullyDecode(url: string): string {
  let current = url;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      // Escapes inválidos: se evalúa lo que se tenga hasta aquí.
      return current;
    }
    if (decoded === current) return current;
    current = decoded;
  }
  return current;
}

export function isSensitiveUrl(url: string): boolean {
  const candidate = fullyDecode(url);
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(candidate));
}

export function isCapturableContentType(contentType: string): boolean {
  return /\bjson\b/i.test(contentType);
}

/** Única puerta de entrada: si esto devuelve false, no se lee nada. */
export function shouldCapture(url: string, contentType: string): boolean {
  if (url.length === 0) return false;
  return !isSensitiveUrl(url) && isCapturableContentType(contentType);
}
