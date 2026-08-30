/**
 * Lo que los bancos añaden a la descripción de un movimiento y estorba tanto
 * para deduplicar (huella del sprint 04) como para reconocer el comercio
 * (sprint 05). Una sola implementación: un arreglo aquí llega a las dos.
 */

/**
 * Prefijos con los que los bancos etiquetan el tipo de movimiento, y los
 * conectores que cada uno admite. «Transferencia a Nequi» lleva conector;
 * «Compra a» no: ahí «a» sería el comercio. Sin esta tabla, el conector se
 * come al comercio cuando coinciden (lo encontró fast-check con «COMPRA A»).
 */
const CONECTORES: Record<string, readonly string[]> = {
  compra: ['pse', 'en'],
  pago: ['pse', 'en', 'a', 'de'],
  abono: ['de', 'en'],
  retiro: ['en', 'de'],
  transferencia: ['a', 'de', 'en'],
  consignacion: ['de', 'en'],
};
const PREFIJO = /^(compra|pago|abono|retiro|transferencia|consignacion)\b\s*/;
/** Terminal o autorización tipo «*4471», «*trip», y números sueltos de 6 o más dígitos. */
const TERMINALES = /\*[\w-]+\s*|\b\d{6,}\b\s*/g;

export function stripAccents(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function stripBankPrefix(texto: string): string {
  const coincidencia = PREFIJO.exec(texto);
  if (coincidencia === null) return texto;
  const prefijo = coincidencia[1] ?? '';
  let resto = texto.slice(coincidencia[0].length);
  const conectores = CONECTORES[prefijo] ?? [];
  if (conectores.length > 0) {
    const sinConector = resto.replace(new RegExp(`^(${conectores.join('|')})\\b\\s*`), '');
    // Si quitar el conector deja vacío, el «conector» era el comercio.
    if (sinConector.trim().length > 0) resto = sinConector;
  }
  return resto.trim();
}

export function stripTerminals(texto: string): string {
  return texto.replace(TERMINALES, '').replace(/\s+/g, ' ').trim();
}

/**
 * Base común: sin acentos, minúsculas, espacios colapsados, sin terminales,
 * sin prefijo. Si todo era ruido devuelve la base: una cadena vacía
 * emparejaría con todo en la deduplicación y no diría nada como comercio.
 */
export function basicClean(raw: string): string {
  const base = stripAccents(raw).toLowerCase().replace(/\s+/g, ' ').trim();
  const limpia = stripBankPrefix(stripTerminals(base));
  return limpia.length > 0 ? limpia : base;
}
