export interface CursorImap {
  uidValidity: number;
  ultimoUid: number;
}

export function formatearCursorImap(c: CursorImap): string {
  return `${String(c.uidValidity)}:${String(c.ultimoUid)}`;
}

export function parsearCursorImap(valor: string | null): CursorImap | null {
  if (valor === null) return null;
  const partes = valor.split(':');
  if (partes.length !== 2) return null;
  const [validez, uid] = partes.map(Number);
  if (validez === undefined || uid === undefined) return null;
  if (!Number.isInteger(validez) || !Number.isInteger(uid)) return null;
  return { uidValidity: validez, ultimoUid: uid };
}

/**
 * Qué UID pedir.
 *
 * `UIDVALIDITY` es la promesa del servidor de que los UID siguen
 * significando lo mismo. Si cambia, el cursor guardado no vale: se empieza de
 * nuevo, y la idempotencia por id de mensaje evita que eso duplique nada.
 */
export function rangoDesde(anterior: CursorImap | null, uidValidityActual: number): string {
  if (anterior === null || anterior.uidValidity !== uidValidityActual) return '1:*';
  return `${String(anterior.ultimoUid + 1)}:*`;
}
