import { createRateSources } from './rate-sources';

describe('createRateSources', () => {
  /**
   * Sin USD→COP no hay patrimonio en pesos, y sin los dos pares de stablecoin
   * el saldo de las wallets se queda «sin valorar» sin decir por qué.
   */
  it('trae los tres pares que hacen falta para valorar en pesos', () => {
    const pares = createRateSources(() => '').map((f) => `${f.par.desde}->${f.par.hacia}`);

    expect(pares).toEqual(['USD->COP', 'USDC->USD', 'USDT->USD']);
  });

  it('no repite ningún par', () => {
    const pares = createRateSources(() => '').map((f) => `${f.par.desde}->${f.par.hacia}`);

    expect(new Set(pares).size).toBe(pares.length);
  });
});
