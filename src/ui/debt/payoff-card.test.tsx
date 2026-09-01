import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { PayoffCard, TEXTO_ESTRATEGIA } from './payoff-card';

const sale = {
  estado: 'sale' as const,
  meses: [],
  fechaDeSalida: '2028-03',
  interesesTotales: money(1_450_000, 'COP'),
};

describe('PayoffCard', () => {
  it('enseña la fecha de salida y los intereses', async () => {
    const { getByText } = await renderWithProviders(
      <PayoffCard titulo={TEXTO_ESTRATEGIA.avalancha} como="x" resultado={sale} />,
    );

    expect(getByText('marzo de 2028')).toBeOnTheScreen();
    expect(getByText('$ 1.450.000')).toBeOnTheScreen();
  });

  /** Una fecha se lee, no se descifra. */
  it('la fecha va en palabras, no como «2028-03»', async () => {
    const { queryByText } = await renderWithProviders(
      <PayoffCard titulo="x" como="y" resultado={sale} />,
    );

    expect(queryByText('2028-03')).toBeNull();
  });

  /**
   * Lo que más importa de esta tarjeta: cuando el presupuesto no cubre los
   * intereses **no se dibuja ninguna fecha**. Ni aproximada ni optimista.
   */
  it('cuando no converge lo dice, y no enseña ninguna fecha', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <PayoffCard
        titulo="x"
        como="y"
        resultado={{ estado: 'no-converge', motivo: 'los intereses se la comen' }}
      />,
    );

    expect(getByText(TEXTO_ESTRATEGIA.noConverge)).toBeOnTheScreen();
    expect(queryByText(/\d{4}/)).toBeNull();
  });

  it('explica qué hace la estrategia, no solo cómo se llama', async () => {
    const { getByText } = await renderWithProviders(
      <PayoffCard
        titulo={TEXTO_ESTRATEGIA.avalancha}
        como={TEXTO_ESTRATEGIA.avalanchaComo}
        resultado={sale}
      />,
    );

    expect(getByText(TEXTO_ESTRATEGIA.avalanchaComo)).toBeOnTheScreen();
  });
});
