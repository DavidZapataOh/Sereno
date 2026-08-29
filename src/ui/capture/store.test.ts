import { useCaptureStore } from './store';
import { CAPTURE_PROTOCOL_VERSION, splitIntoFragments } from '@/domain/capture/protocol';

function metaMessage(id: string, url: string, totalFragments: number): string {
  return JSON.stringify({
    type: 'sereno:meta',
    v: CAPTURE_PROTOCOL_VERSION,
    id,
    url,
    method: 'GET',
    status: 200,
    contentType: 'application/json',
    kind: 'fetch',
    capturedAt: '2026-08-28T15:00:00.000Z',
    totalFragments,
  });
}

function fragmentMessage(id: string, body: string): string {
  return JSON.stringify(splitIntoFragments(id, body)[0]);
}

describe('useCaptureStore', () => {
  beforeEach(() => {
    useCaptureStore.getState().clear();
  });

  it('arranca vacío', () => {
    expect(useCaptureStore.getState().captures).toEqual([]);
    expect(useCaptureStore.getState().descartados).toBe(0);
  });

  it('acumula una captura completa', () => {
    const { handleMessage } = useCaptureStore.getState();
    handleMessage(metaMessage('a', 'https://banco.example/api/x', 1));
    handleMessage(fragmentMessage('a', '{"v":1}'));
    expect(useCaptureStore.getState().captures).toHaveLength(1);
    expect(useCaptureStore.getState().captures[0].body).toBe('{"v":1}');
  });

  it('cuenta los mensajes que no cumplen el protocolo', () => {
    const { handleMessage } = useCaptureStore.getState();
    handleMessage('basura');
    handleMessage(JSON.stringify({ type: 'ajeno' }));
    expect(useCaptureStore.getState().captures).toEqual([]);
    expect(useCaptureStore.getState().descartados).toBe(2);
  });

  it('conserva el orden de llegada', () => {
    const { handleMessage } = useCaptureStore.getState();
    handleMessage(metaMessage('a', 'https://banco.example/api/uno', 1));
    handleMessage(fragmentMessage('a', 'primero'));
    handleMessage(metaMessage('b', 'https://banco.example/api/dos', 1));
    handleMessage(fragmentMessage('b', 'segundo'));
    expect(useCaptureStore.getState().captures.map((c) => c.body)).toEqual(['primero', 'segundo']);
  });

  it('clear vacía las capturas y el contador', () => {
    const { handleMessage } = useCaptureStore.getState();
    handleMessage(metaMessage('a', 'https://banco.example/api/x', 1));
    handleMessage(fragmentMessage('a', 'x'));
    handleMessage('basura');
    useCaptureStore.getState().clear();
    expect(useCaptureStore.getState().captures).toEqual([]);
    expect(useCaptureStore.getState().descartados).toBe(0);
  });

  it('clear reinicia también las capturas a medio reensamblar', () => {
    const { handleMessage } = useCaptureStore.getState();
    handleMessage(metaMessage('a', 'https://banco.example/api/x', 2));
    handleMessage(JSON.stringify(splitIntoFragments('a', 'mitad')[0]));
    useCaptureStore.getState().clear();

    // El fragmento restante de la sesión anterior debe quedar huérfano.
    handleMessage(JSON.stringify({ type: 'sereno:fragment', v: 1, id: 'a', seq: 1, data: 'x' }));
    expect(useCaptureStore.getState().captures).toEqual([]);
  });
});
