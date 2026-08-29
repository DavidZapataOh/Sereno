import {
  CAPTURE_PROTOCOL_VERSION,
  MAX_FRAGMENT_BYTES,
  parseSerenoMessage,
  splitIntoFragments,
  type CaptureMeta,
} from './protocol';
import { exigir } from '@/test/exigir';

describe('splitIntoFragments', () => {
  it('devuelve un solo fragmento cuando el cuerpo cabe', () => {
    expect(splitIntoFragments('abc', 'hola')).toEqual([
      { type: 'sereno:fragment', v: CAPTURE_PROTOCOL_VERSION, id: 'abc', seq: 0, data: 'hola' },
    ]);
  });

  it('parte cuerpos grandes en varios fragmentos numerados', () => {
    const fragments = splitIntoFragments('abc', 'x'.repeat(MAX_FRAGMENT_BYTES * 2 + 10));
    expect(fragments).toHaveLength(3);
    expect(fragments.map((f) => f.seq)).toEqual([0, 1, 2]);
  });

  it('preserva el cuerpo completo al concatenar', () => {
    const body = 'y'.repeat(MAX_FRAGMENT_BYTES + 500);
    expect(
      splitIntoFragments('abc', body)
        .map((f) => f.data)
        .join(''),
    ).toBe(body);
  });

  it('devuelve un fragmento vacío para un cuerpo vacío', () => {
    const fragments = splitIntoFragments('abc', '');
    expect(fragments).toHaveLength(1);
    expect(exigir(fragments[0]).data).toBe('');
  });

  it('respeta el límite de tamaño en cada fragmento', () => {
    const fragments = splitIntoFragments('abc', 'z'.repeat(MAX_FRAGMENT_BYTES * 3));
    fragments.forEach((fragment) => {
      expect(fragment.data.length).toBeLessThanOrEqual(MAX_FRAGMENT_BYTES);
    });
  });
});

describe('parseSerenoMessage', () => {
  const meta: CaptureMeta = {
    type: 'sereno:meta',
    v: CAPTURE_PROTOCOL_VERSION,
    id: 'abc',
    url: 'https://banco.example/api/movimientos',
    method: 'GET',
    status: 200,
    contentType: 'application/json',
    kind: 'fetch',
    capturedAt: '2026-08-28T15:00:00.000Z',
    totalFragments: 1,
  };

  it('acepta un mensaje de metadatos válido', () => {
    expect(parseSerenoMessage(JSON.stringify(meta))).toEqual(meta);
  });

  it('acepta un fragmento válido', () => {
    const fragment = {
      type: 'sereno:fragment',
      v: CAPTURE_PROTOCOL_VERSION,
      id: 'abc',
      seq: 0,
      data: '{}',
    };
    expect(parseSerenoMessage(JSON.stringify(fragment))).toEqual(fragment);
  });

  it('rechaza JSON malformado sin lanzar', () => {
    expect(parseSerenoMessage('{no es json')).toBeNull();
  });

  it('rechaza mensajes ajenos al protocolo', () => {
    expect(parseSerenoMessage(JSON.stringify({ type: 'otra-cosa' }))).toBeNull();
  });

  it('rechaza metadatos incompletos', () => {
    expect(parseSerenoMessage(JSON.stringify({ type: 'sereno:meta', v: 1 }))).toBeNull();
  });

  it('rechaza una versión de protocolo distinta', () => {
    expect(parseSerenoMessage(JSON.stringify({ ...meta, v: 99 }))).toBeNull();
  });

  it('rechaza un fragmento con secuencia negativa', () => {
    const fragment = { type: 'sereno:fragment', v: 1, id: 'abc', seq: -1, data: 'x' };
    expect(parseSerenoMessage(JSON.stringify(fragment))).toBeNull();
  });

  it('rechaza una cadena vacía', () => {
    expect(parseSerenoMessage('')).toBeNull();
  });

  it('rechaza un arreglo en la raíz', () => {
    expect(parseSerenoMessage('[]')).toBeNull();
  });
});
