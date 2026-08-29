import type { CaptureKind, CaptureMeta, SerenoMessage } from './protocol';

export interface Capture {
  id: string;
  url: string;
  method: string;
  status: number;
  contentType: string;
  kind: CaptureKind;
  capturedAt: string;
  body: string;
}

interface Pending {
  meta: CaptureMeta;
  fragments: Map<number, string>;
}

/**
 * Techo de capturas a medio recomponer.
 *
 * Una captura cuyo último fragmento nunca llega —porque la página se recargó a
 * media respuesta— quedaría en memoria para siempre. El límite acota el consumo
 * descartando las más antiguas.
 */
const MAX_PENDING = 50;

/**
 * Recompone las capturas a partir de los mensajes de la WebView.
 *
 * Tolera fragmentos desordenados, duplicados y huérfanos: el orden de llegada
 * por el puente no está garantizado y una página puede recargarse a mitad de
 * una respuesta.
 */
export class CaptureReassembler {
  private readonly pending = new Map<string, Pending>();

  accept(message: SerenoMessage): Capture | null {
    if (message.type === 'sereno:meta') {
      this.evictIfNeeded();
      this.pending.set(message.id, { meta: message, fragments: new Map() });
      return message.totalFragments === 0 ? this.complete(message.id) : null;
    }

    const entry = this.pending.get(message.id);
    if (entry === undefined) return null;

    entry.fragments.set(message.seq, message.data);
    if (entry.fragments.size < entry.meta.totalFragments) return null;

    return this.complete(message.id);
  }

  pendingCount(): number {
    return this.pending.size;
  }

  private evictIfNeeded(): void {
    while (this.pending.size >= MAX_PENDING) {
      // Map conserva el orden de inserción: el primero es el más antiguo.
      const oldest = this.pending.keys().next();
      if (oldest.done === true) return;
      this.pending.delete(oldest.value);
    }
  }

  private complete(id: string): Capture | null {
    const entry = this.pending.get(id);
    if (entry === undefined) return null;
    this.pending.delete(id);

    const { meta } = entry;
    const body = Array.from(
      { length: meta.totalFragments },
      (_, seq) => entry.fragments.get(seq) ?? '',
    ).join('');

    return {
      id: meta.id,
      url: meta.url,
      method: meta.method,
      status: meta.status,
      contentType: meta.contentType,
      kind: meta.kind,
      capturedAt: meta.capturedAt,
      body,
    };
  }
}
