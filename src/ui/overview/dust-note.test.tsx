import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { DustNote, TEXTO_POLVO } from './dust-note';

describe('DustNote', () => {
  it('dice cuántos saldos son y cuánto suman', async () => {
    const { getByText } = await renderWithProviders(
      <DustNote cuantas={3} total={money(812n, 'COP')} />,
    );

    expect(getByText(TEXTO_POLVO.explicacion(3))).toBeOnTheScreen();
    expect(getByText('$ 812')).toBeOnTheScreen();
  });

  it('en singular no dice «1 saldos»', async () => {
    const { getByText } = await renderWithProviders(
      <DustNote cuantas={1} total={money(274n, 'COP')} />,
    );

    expect(getByText(/^Además, 1 saldo cripto/)).toBeOnTheScreen();
  });

  /**
   * Sin polvo no hay renglón: un aviso que dice «0 saldos» es ruido, y la
   * pantalla ya tiene bastante.
   */
  it('sin polvo no pinta nada', async () => {
    const { queryByText } = await renderWithProviders(
      <DustNote cuantas={0} total={money(0n, 'COP')} />,
    );

    expect(queryByText(/Además/)).toBeNull();
  });

  /**
   * El texto tiene que decir que **suman**. Un usuario que ve un renglón
   * aparte asume que está fuera del total, y entonces la cuenta no le cuadra.
   */
  it('deja claro que están sumados en el total', () => {
    expect(TEXTO_POLVO.explicacion(2)).toMatch(/sumados en el total/);
    expect(TEXTO_POLVO.explicacion(1)).toMatch(/sumado en el total/);
  });
});
