import type { FundState } from '@/application/sinking/manage-funds';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { FundRow, TEXTO_FONDO } from './fund-row';

const base: FundState = {
  fondo: {
    accountId: accountId('fondo:seguro'),
    owner: ownerId('david'),
    nombre: 'Seguro del carro',
    tipo: 'gasto',
    objetivo: money(1_200_000, 'COP'),
    proximaFecha: '2027-09-01',
    cadaMeses: 12,
  },
  apartado: money(300_000, 'COP'),
  falta: money(900_000, 'COP'),
  aporteDeEsteMes: money(92_000, 'COP'),
  alcanza: true,
};

describe('FundRow', () => {
  it('enseña cuánto lleva, cuánto falta y qué toca este mes', async () => {
    const { getByText } = await renderWithProviders(<FundRow estado={base} />);

    expect(getByText('$ 300.000')).toBeOnTheScreen();
    expect(getByText('$ 900.000')).toBeOnTheScreen();
    expect(getByText('$ 92.000')).toBeOnTheScreen();
  });

  /** Se avisa mientras todavía se puede hacer algo, no el día del cobro. */
  it('un fondo que no va a alcanzar lo dice con palabras', async () => {
    const { getByText } = await renderWithProviders(
      <FundRow estado={{ ...base, alcanza: false }} />,
    );

    expect(getByText(TEXTO_FONDO.noAlcanza)).toBeOnTheScreen();
  });

  it('un fondo completo se ve completo, sin celebrarlo', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <FundRow estado={{ ...base, apartado: money(1_200_000, 'COP'), falta: money(0, 'COP') }} />,
    );

    expect(getByText(TEXTO_FONDO.completo)).toBeOnTheScreen();
    expect(queryByText(TEXTO_FONDO.esteMes)).toBeNull();
  });

  it('cuando alcanza, no mete miedo', async () => {
    const { queryByText } = await renderWithProviders(<FundRow estado={base} />);

    expect(queryByText(TEXTO_FONDO.noAlcanza)).toBeNull();
  });
});
