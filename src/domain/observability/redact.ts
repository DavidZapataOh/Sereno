export const REDACTED = '[redactado]';

const MAX_DEPTH = 10;

/**
 * Claves cuyo valor nunca debe salir del dispositivo.
 *
 * Incluye montos y saldos: en una app financiera, la cifra ES el dato sensible.
 * Ante la duda, se añade la clave.
 */
const SENSITIVE_KEYS: readonly RegExp[] = [
  /token/i,
  /password/i,
  /clave/i,
  /secret/i,
  /credential/i,
  /apikey/i,
  /api_key/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /saldo/i,
  /balance/i,
  /monto/i,
  /amount/i,
  /cuenta/i,
  /account/i,
  /email/i,
  /correo/i,
  /phone/i,
  /celular/i,
  /telefono/i,
  /documento/i,
];

/** Formas reconocibles de datos sensibles dentro de una cadena. */
const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,
  /\b(?:\d[ -]?){13,19}\b/g,
  /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.some((pattern) => pattern.test(key));
}

function redactString(value: string): string {
  return SENSITIVE_VALUE_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, REDACTED), value);
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return REDACTED;

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack === undefined ? undefined : redactString(value.stack),
    };
  }

  if (typeof value !== 'object') return REDACTED;
  if (seen.has(value)) return REDACTED;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactValue(item, depth + 1, seen);
  }
  return result;
}

/**
 * Devuelve una copia del valor sin datos sensibles.
 *
 * Nunca muta la entrada, tolera referencias circulares y corta a una profundidad
 * máxima: un registro no puede tumbar la app ni colgarla.
 */
export function redact(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet<object>());
}
