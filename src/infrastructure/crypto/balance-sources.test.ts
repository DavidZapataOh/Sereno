import { CHAINS } from '@/domain/crypto/wallet';

import { createBalanceSources } from './balance-sources';

describe('createBalanceSources', () => {
  /**
   * La prueba que importa: una cadena declarada sin fuente se salta en
   * silencio y su saldo se queda en cero para siempre.
   */
  it('hay una fuente por cada cadena declarada', () => {
    const fuentes = createBalanceSources(() => '2026-08-31T10:00:00.000-05:00');

    expect(fuentes.map((f) => f.chain).sort()).toEqual([...CHAINS].sort());
  });

  it('no repite ninguna cadena', () => {
    const cadenas = createBalanceSources(() => '').map((f) => f.chain);

    expect(new Set(cadenas).size).toBe(cadenas.length);
  });
});
