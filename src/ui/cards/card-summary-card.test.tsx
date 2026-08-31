import type { CardSummary } from '@/application/cards/card-summary';
import { accountId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { CardSummaryCard, TEXTO_TARJETA } from './card-summary-card';

const base: CardSummary = {
  accountId: accountId('rappicard:tarjeta'),
  nombre: 'RappiCard',
  cupo: money(3_000_000, 'COP'),
  deuda: money(1_200_000, 'COP'),
  disponible: money(1_800_000, 'COP'),
  usado: 0.4,
  diaDeCorte: 15,
  diaDePago: 5,
  completa: true,
};

describe('CardSummaryCard', () => {
  it('lo primero que enseña es cuánto queda para gastar', async () => {
    const { getByText, getByTestId } = await renderWithProviders(
      <CardSummaryCard resumen={base} />,
    );

    expect(getByText(TEXTO_TARJETA.disponible)).toBeOnTheScreen();
    expect(getByTestId('tarjeta-disponible')).toHaveTextContent('$ 1.800.000');
  });

  it('dice cuándo corta y cuándo se paga', async () => {
    const { getByText } = await renderWithProviders(<CardSummaryCard resumen={base} />);

    expect(getByText(/Corta el 15/)).toBeOnTheScreen();
    expect(getByText(/Se paga el 5/)).toBeOnTheScreen();
  });

  /**
   * Sobregirarse pasa. Mostrar «disponible: 0» escondería justo el momento en
   * que hay que hacer algo.
   */
  it('cuando la deuda pasa el cupo lo dice, y no muestra cero', async () => {
    const { getByText, queryByText, getByTestId } = await renderWithProviders(
      <CardSummaryCard
        resumen={{
          ...base,
          deuda: money(3_100_000, 'COP'),
          disponible: money(-100_000, 'COP'),
          usado: 1.03,
        }}
      />,
    );

    expect(getByText(TEXTO_TARJETA.sobregiro)).toBeOnTheScreen();
    expect(queryByText(TEXTO_TARJETA.disponible)).toBeNull();
    // El monto del sobregiro, no el de la deuda: por eso va por testID y no
    // por texto —«100.000» también está dentro de «3.100.000»—.
    // Con el signo: un disponible negativo es un sobregiro, y el número lo dice.
    expect(getByTestId('tarjeta-disponible')).toHaveTextContent('−$ 100.000');
  });

  /**
   * Nu solo avisa del pago de la cuota. Un número que parece completo y no lo
   * es miente más que un hueco declarado.
   */
  it('cuando la fuente está incompleta, lo advierte', async () => {
    const { getByText } = await renderWithProviders(
      <CardSummaryCard resumen={{ ...base, nombre: 'Nu', completa: false }} />,
    );

    expect(getByText(TEXTO_TARJETA.incompleta)).toBeOnTheScreen();
  });

  it('cuando está completa, no advierte nada', async () => {
    const { queryByText } = await renderWithProviders(<CardSummaryCard resumen={base} />);

    expect(queryByText(TEXTO_TARJETA.incompleta)).toBeNull();
  });
});
