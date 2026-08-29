import { parseSerenoMessage } from '@/domain/capture/protocol';
import { CaptureReassembler, type Capture } from '@/domain/capture/reassembler';

export class FakeResponse {
  constructor(
    readonly url: string,
    readonly status: number,
    private readonly contentType: string,
    private readonly body: string,
  ) {}

  get headers(): { get: (name: string) => string | null } {
    return {
      get: (name) => (name.toLowerCase() === 'content-type' ? this.contentType : null),
    };
  }

  clone(): FakeResponse {
    return new FakeResponse(this.url, this.status, this.contentType, this.body);
  }

  text(): Promise<string> {
    return Promise.resolve(this.body);
  }
}

export class FakeXHR {
  responseText = '';
  status = 200;
  private readonly listeners: (() => void)[] = [];
  private readonly headers: Record<string, string> = {};

  open(_method: string, _url: string): void {
    // El script sustituye este método; el original no hace nada.
  }

  send(_body?: unknown): void {
    // Igual que open: el comportamiento real lo aporta el script.
  }

  addEventListener(_event: string, callback: () => void): void {
    this.listeners.push(callback);
  }

  getResponseHeader(name: string): string | null {
    return this.headers[name.toLowerCase()] ?? null;
  }

  /** Simula que la respuesta llegó y dispara el evento `load`. */
  simulateLoad(contentType: string, body: string): void {
    this.headers['content-type'] = contentType;
    this.responseText = body;
    this.listeners.forEach((callback) => {
      callback.call(this);
    });
  }
}

export interface FakeWindow {
  fetch: (input?: unknown, init?: unknown) => Promise<FakeResponse>;
  XMLHttpRequest: typeof FakeXHR;
  ReactNativeWebView: { postMessage: (message: string) => void };
}

/**
 * Ejecuta el script sobre un `window` simulado cuyo `fetch` original devuelve
 * `response`, y recoge las capturas completas que emite.
 */
export function installScript(
  script: string,
  response: FakeResponse,
): { win: FakeWindow; captures: Capture[] } {
  const captures: Capture[] = [];
  const reassembler = new CaptureReassembler();

  const win = {
    ReactNativeWebView: {
      postMessage(raw: string) {
        const message = parseSerenoMessage(raw);
        if (message === null) return;
        const capture = reassembler.accept(message);
        if (capture !== null) captures.push(capture);
      },
    },
    fetch: () => Promise.resolve(response),
    XMLHttpRequest: FakeXHR,
  };

  // El script espera `window` y `XMLHttpRequest` en su ámbito, igual que en la
  // WebView. Ejecutarlo es el propósito de este arnés: sin evaluarlo no hay forma
  // de comprobar que intercepta lo que debe y respeta la frontera de seguridad.
  // El texto lo genera `buildInjectedScript`, no viene de fuera.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- ver comentario
  new Function('window', 'XMLHttpRequest', script).call(win, win, win.XMLHttpRequest);

  return { win, captures };
}

/** Deja correr las promesas pendientes que el script encadenó. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
