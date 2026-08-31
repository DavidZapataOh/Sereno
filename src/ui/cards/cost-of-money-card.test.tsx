import type { CostOfMoney } from '@/application/cards/cost-of-money';
import { transactionId } from '@/domain/ledger/ids';
import { money, zero } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { CostOfMoneyCard, NOMBRE_DE_COSTO, TEXTO_COSTO } from './cost-of-money-card';

const base: CostOfMoney = {
  total: money(22_000, 'COP'),
  porTipo: {
    'cuatro-por-mil': money(4_000, 'COP'),
    'comisiones-bancarias': money(18_000, 'COP'),
    'intereses-de-credito': zero('COP'),
    seguros: zero('COP'),
  },
  movido: money(1_000_000, 'COP'),
  proporcion: 0.022,
  masCaro: { transaccion: transactionId('t1'), costo: money(4_000, 'COP') },
};

describe('CostOfMoneyCard', () => {
  it('enseña el total y de qué se compone', async () => {
    const { getByText, getByTestId } = await renderWithProviders(<CostOfMoneyCard costo={base} />);

    expect(getByTestId('costo-total')).toHaveTextContent('$ 22.000');
    expect(getByText(NOMBRE_DE_COSTO['cuatro-por-mil'])).toBeOnTheScreen();
    expect(getByText(NOMBRE_DE_COSTO['comisiones-bancarias'])).toBeOnTheScreen();
  });

  /**
   * «$22.000» dice poco por sí solo; «el 2,2 % de lo que moviste» dice qué
   * hacer.
   */
  it('pone el total en contexto con la proporción', async () => {
    const { getByText } = await renderWithProviders(<CostOfMoneyCard costo={base} />);

    expect(getByText(TEXTO_COSTO.proporcion(2.2))).toBeOnTheScreen();
  });

  it('no lista los tipos que no aparecieron', async () => {
    const { queryByText } = await renderWithProviders(<CostOfMoneyCard costo={base} />);

    expect(queryByText(NOMBRE_DE_COSTO.seguros)).toBeNull();
  });

  it('sin cargos lo dice en una frase, sin una tabla de ceros', async () => {
    const { getByText, queryByTestId } = await renderWithProviders(
      <CostOfMoneyCard
        costo={{
          ...base,
          total: zero('COP'),
          porTipo: {
            'cuatro-por-mil': zero('COP'),
            'comisiones-bancarias': zero('COP'),
            'intereses-de-credito': zero('COP'),
            seguros: zero('COP'),
          },
          masCaro: null,
        }}
      />,
    );

    expect(getByText(TEXTO_COSTO.ninguno)).toBeOnTheScreen();
    expect(queryByTestId('costo-total')).toBeNull();
  });

  it('cuando no se pudo atar ningún cargo, no habla del movimiento más caro', async () => {
    const { queryByText } = await renderWithProviders(
      <CostOfMoneyCard costo={{ ...base, masCaro: null }} />,
    );

    expect(queryByText(TEXTO_COSTO.masCaro)).toBeNull();
  });
});
