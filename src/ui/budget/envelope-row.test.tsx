import { ownerId } from '@/domain/ledger/ids';
import { estadoDe } from '@/domain/budget/envelope';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { EnvelopeRow, TEXTO_SOBRE } from './envelope-row';

const owner = ownerId('david');
const COP = 'COP' as const;

const sobre = (asignado: number, gastado: number) =>
  estadoDe(
    { owner, mes: '2026-09', categoria: 'mercado', asignado: money(asignado, COP) },
    money(gastado, COP),
  );

describe('EnvelopeRow', () => {
  it('enseña lo asignado, y lo que queda', async () => {
    const { getByText } = await renderWithProviders(
      <EnvelopeRow estado={sobre(600_000, 250_000)} historico={undefined} />,
    );

    expect(getByText('$ 600.000')).toBeOnTheScreen();
    expect(getByText('$ 350.000')).toBeOnTheScreen();
    expect(getByText(TEXTO_SOBRE.queda)).toBeOnTheScreen();
  });

  /** El color solo excluye a quien no lo distingue. */
  it('un sobre sobregirado lo dice con palabras', async () => {
    const { getByText } = await renderWithProviders(
      <EnvelopeRow estado={sobre(600_000, 700_000)} historico={undefined} />,
    );

    expect(getByText(TEXTO_SOBRE.sobregirado)).toBeOnTheScreen();
    expect(getByText('−$ 100.000')).toBeOnTheScreen();
  });

  it('enseña el histórico diciendo de cuántos meses es', async () => {
    const { getByText } = await renderWithProviders(
      <EnvelopeRow
        estado={sobre(600_000, 0)}
        historico={{ categoria: 'mercado', promedio: money(580_000, COP), meses: 3 }}
      />,
    );

    expect(getByText(/3 meses/)).toBeOnTheScreen();
    expect(getByText(/580\.000/)).toBeOnTheScreen();
  });

  /** Un promedio de un mes es un dato disfrazado de consejo. */
  it('con poca historia no enseña un promedio que engañe', async () => {
    const { getByText } = await renderWithProviders(
      <EnvelopeRow
        estado={sobre(600_000, 0)}
        historico={{ categoria: 'mercado', promedio: null, meses: 1 }}
      />,
    );

    expect(getByText(TEXTO_SOBRE.sinHistorico)).toBeOnTheScreen();
  });
});
