import { buildDump } from './dump';
import type { Capture } from './reassembler';

const capture: Capture = {
  id: 'a',
  url: 'https://banco.example/api/movimientos',
  method: 'GET',
  status: 200,
  contentType: 'application/json',
  kind: 'fetch',
  capturedAt: '2026-08-28T15:00:00.000Z',
  body: '{"saldo":1000}',
};

describe('buildDump', () => {
  it('produce JSON válido', () => {
    expect(() => {
      JSON.parse(buildDump([capture]));
    }).not.toThrow();
  });

  it('incluye la versión del protocolo y el conteo', () => {
    const dump = JSON.parse(buildDump([capture])) as { protocolVersion: number; count: number };
    expect(dump.protocolVersion).toBe(1);
    expect(dump.count).toBe(1);
  });

  it('conserva el cuerpo íntegro', () => {
    const dump = JSON.parse(buildDump([capture])) as { captures: Capture[] };
    expect(dump.captures[0].body).toBe('{"saldo":1000}');
  });

  it('maneja una lista vacía', () => {
    const dump = JSON.parse(buildDump([])) as { count: number; captures: Capture[] };
    expect(dump.count).toBe(0);
    expect(dump.captures).toEqual([]);
  });

  it('incluye una advertencia sobre el contenido', () => {
    const dump = JSON.parse(buildDump([capture])) as { advertencia: string };
    expect(dump.advertencia).toContain('datos bancarios reales');
  });
});
