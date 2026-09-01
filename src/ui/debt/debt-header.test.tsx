import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { DebtHeader, TEXTO_DEUDA } from './debt-header';

describe('DebtHeader', () => {
  it('la cifra grande es cuánto se debe', async () => {
    const { getByText } = await renderWithProviders(
      <DebtHeader total={money(2_500_000, 'COP')} cambio={null} fechaDeSalida={null} />,
    );

    expect(getByText('$ 2.500.000')).toBeOnTheScreen();
  });

  it('dice si se debe menos que hace un mes, y cuánto menos', async () => {
    const { getByText } = await renderWithProviders(
      <DebtHeader
        total={money(2_000_000, 'COP')}
        cambio={money(-500_000, 'COP')}
        fechaDeSalida={null}
      />,
    );

    expect(getByText(TEXTO_DEUDA.bajo('$ 500.000'))).toBeOnTheScreen();
  });

  it('dice si se debe más', async () => {
    const { getByText } = await renderWithProviders(
      <DebtHeader
        total={money(2_000_000, 'COP')}
        cambio={money(300_000, 'COP')}
        fechaDeSalida={null}
      />,
    );

    expect(getByText(TEXTO_DEUDA.subio('$ 300.000'))).toBeOnTheScreen();
  });

  /**
   * «Sin comparación» y «no cambió» son cosas distintas. Decir «igual que hace
   * un mes» cuando no había historia sería falso.
   */
  it('sin comparación posible no inventa un «igual»', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <DebtHeader total={money(1_000_000, 'COP')} cambio={null} fechaDeSalida={null} />,
    );

    expect(getByText(TEXTO_DEUDA.sinComparacion)).toBeOnTheScreen();
    expect(queryByText(TEXTO_DEUDA.igual)).toBeNull();
  });

  /** Una fecha de salida sin condicional se lee como una promesa. */
  it('enseña la fecha de salida como proyección, no como hecho', async () => {
    const { getByText } = await renderWithProviders(
      <DebtHeader total={money(1_000_000, 'COP')} cambio={null} fechaDeSalida="marzo de 2028" />,
    );

    expect(getByText(/Si sigues así/)).toBeOnTheScreen();
  });

  it('sin deudas lo dice, y no enseña una fecha de salida', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <DebtHeader total={money(0, 'COP')} cambio={null} fechaDeSalida="marzo de 2028" />,
    );

    expect(getByText(TEXTO_DEUDA.sinDeudas)).toBeOnTheScreen();
    expect(queryByText(/Si sigues así/)).toBeNull();
  });
});
