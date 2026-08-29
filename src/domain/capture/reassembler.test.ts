import { CaptureReassembler } from './reassembler';
import { CAPTURE_PROTOCOL_VERSION, type CaptureFragment, type CaptureMeta } from './protocol';

function meta(id: string, totalFragments: number): CaptureMeta {
  return {
    type: 'sereno:meta',
    v: CAPTURE_PROTOCOL_VERSION,
    id,
    url: 'https://banco.example/api/movimientos',
    method: 'GET',
    status: 200,
    contentType: 'application/json',
    kind: 'fetch',
    capturedAt: '2026-08-28T15:00:00.000Z',
    totalFragments,
  };
}

function fragment(id: string, seq: number, data: string): CaptureFragment {
  return { type: 'sereno:fragment', v: CAPTURE_PROTOCOL_VERSION, id, seq, data };
}

describe('CaptureReassembler', () => {
  it('completa una captura de un solo fragmento', () => {
    const r = new CaptureReassembler();
    expect(r.accept(meta('a', 1))).toBeNull();
    const capture = r.accept(fragment('a', 0, '{"saldo":1000}'));
    expect(capture?.body).toBe('{"saldo":1000}');
    expect(capture?.url).toBe('https://banco.example/api/movimientos');
    expect(capture?.status).toBe(200);
  });

  it('reensambla varios fragmentos en orden', () => {
    const r = new CaptureReassembler();
    r.accept(meta('a', 3));
    expect(r.accept(fragment('a', 0, 'uno'))).toBeNull();
    expect(r.accept(fragment('a', 1, 'dos'))).toBeNull();
    expect(r.accept(fragment('a', 2, 'tres'))?.body).toBe('unodostres');
  });

  it('reensambla aunque lleguen desordenados', () => {
    const r = new CaptureReassembler();
    r.accept(meta('a', 3));
    r.accept(fragment('a', 2, 'tres'));
    r.accept(fragment('a', 0, 'uno'));
    expect(r.accept(fragment('a', 1, 'dos'))?.body).toBe('unodostres');
  });

  it('mantiene separadas dos capturas simultáneas', () => {
    const r = new CaptureReassembler();
    r.accept(meta('a', 1));
    r.accept(meta('b', 1));
    expect(r.accept(fragment('b', 0, 'de-b'))?.body).toBe('de-b');
    expect(r.accept(fragment('a', 0, 'de-a'))?.body).toBe('de-a');
  });

  it('descarta fragmentos sin metadatos previos', () => {
    const r = new CaptureReassembler();
    expect(r.accept(fragment('fantasma', 0, 'x'))).toBeNull();
    expect(r.pendingCount()).toBe(0);
  });

  it('libera la captura pendiente al completarse', () => {
    const r = new CaptureReassembler();
    r.accept(meta('a', 1));
    expect(r.pendingCount()).toBe(1);
    r.accept(fragment('a', 0, 'x'));
    expect(r.pendingCount()).toBe(0);
  });

  it('ignora un fragmento duplicado sin corromper el cuerpo', () => {
    const r = new CaptureReassembler();
    r.accept(meta('a', 2));
    r.accept(fragment('a', 0, 'uno'));
    r.accept(fragment('a', 0, 'uno'));
    expect(r.accept(fragment('a', 1, 'dos'))?.body).toBe('unodos');
  });

  it('completa una captura declarada con cero fragmentos', () => {
    const r = new CaptureReassembler();
    expect(r.accept(meta('a', 0))?.body).toBe('');
  });

  it('descarta las capturas pendientes más antiguas al superar el límite', () => {
    const r = new CaptureReassembler();
    for (let i = 0; i < 60; i += 1) {
      r.accept(meta(`id-${String(i)}`, 2));
      r.accept(fragment(`id-${String(i)}`, 0, 'incompleta'));
    }
    expect(r.pendingCount()).toBeLessThanOrEqual(50);
  });

  it('unos metadatos repetidos reinician la captura', () => {
    const r = new CaptureReassembler();
    r.accept(meta('a', 2));
    r.accept(fragment('a', 0, 'viejo'));
    r.accept(meta('a', 1));
    expect(r.accept(fragment('a', 0, 'nuevo'))?.body).toBe('nuevo');
  });
});
