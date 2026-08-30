export interface PayloadGmail {
  mimeType?: string | null;
  headers?: { name?: string | null; value?: string | null }[] | null;
  body?: { data?: string | null } | null;
  parts?: PayloadGmail[] | null;
}

export function cabecera(payload: PayloadGmail, nombre: string): string {
  const buscada = nombre.toLowerCase();
  return payload.headers?.find((h) => h.name?.toLowerCase() === buscada)?.value ?? '';
}

function decodificar(datos: string | null | undefined): string {
  return datos === null || datos === undefined
    ? ''
    : Buffer.from(datos, 'base64url').toString('utf8');
}

/** Recorre el árbol de partes hasta encontrar texto plano y HTML. */
export function parteDeTexto(payload: PayloadGmail): { texto: string; html: string | null } {
  let texto = '';
  let html: string | null = null;

  const visitar = (parte: PayloadGmail): void => {
    if (parte.mimeType === 'text/plain' && texto === '') texto = decodificar(parte.body?.data);
    if (parte.mimeType === 'text/html' && html === null) html = decodificar(parte.body?.data);
    for (const hija of parte.parts ?? []) visitar(hija);
  };
  visitar(payload);

  return { texto, html };
}
