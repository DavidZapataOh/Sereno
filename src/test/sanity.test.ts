import { marker } from '@/test/sanity-target';

describe('infraestructura de pruebas', () => {
  it('resuelve el alias @/ hacia src', () => {
    expect(marker).toBe('ok');
  });
});
