/**
 * Interpreta un monto que puede llegar como número o como texto con formato local.
 *
 * Devuelve un entero con signo, o `null` si no es interpretable. Los decimales se
 * truncan: el peso colombiano no los usa en la práctica, y las fases posteriores
 * manejan la escala por moneda de forma explícita.
 *
 * El problema real es la ambigüedad: «1.200» son mil doscientos pesos en Colombia
 * y uno con dos décimas en inglés. Confundirlos es un error de tres órdenes de
 * magnitud.
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.trunc(raw) : null;
  }
  if (typeof raw !== 'string') return null;

  const text = raw.trim();
  if (text.length === 0) return null;

  const negative = text.startsWith('-') || text.endsWith('-') || /^\(.*\)$/.test(text);

  const cleaned = text.replace(/[^\d.,]/g, '');
  if (cleaned.length === 0) return null;

  const integerPart = extractIntegerPart(cleaned);
  if (integerPart.length === 0) return null;

  const value = Number.parseInt(integerPart, 10);
  if (Number.isNaN(value)) return null;

  return negative ? -value : value;
}

/**
 * Descarta la parte decimal y devuelve solo los dígitos enteros.
 *
 * Reglas, en orden:
 *   1. Si aparecen los dos separadores, el que esté más a la derecha es el decimal.
 *   2. Si aparece uno solo más de una vez, es separador de miles.
 *   3. Si aparece una sola vez, decide cuántos dígitos le siguen: exactamente
 *      tres significa miles; uno o dos, decimal.
 */
function extractIntegerPart(cleaned: string): string {
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  const onlyDigits = (value: string): string => value.replace(/\D/g, '');

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalAt = Math.max(lastDot, lastComma);
    return onlyDigits(cleaned.slice(0, decimalAt));
  }

  const separatorAt = lastDot !== -1 ? lastDot : lastComma;
  if (separatorAt === -1) return onlyDigits(cleaned);

  const separator = cleaned.charAt(separatorAt);
  const occurrences = cleaned.split(separator).length - 1;
  if (occurrences > 1) return onlyDigits(cleaned);

  const decimals = cleaned.length - separatorAt - 1;
  // Tres dígitos después de un único separador: es separador de miles.
  return decimals === 3 ? onlyDigits(cleaned) : onlyDigits(cleaned.slice(0, separatorAt));
}
