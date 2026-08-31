import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { OverviewHeader } from './overview-header';

/**
 * El caso de David, 2026-08-31: sus cuentas sumaban −1.814.013 y la cabecera
 * mostraba «$ 1.814.013». Le decía que tenía la plata que en realidad debe.
 */
describe('patrimonio negativo', () => {
  it('muestra el menos cuando se debe más de lo que se tiene', async () => {
    const { getByText } = await renderWithProviders(
      <OverviewHeader
        patrimonio={money(-1_814_013, 'COP')}
        ultimaSincronizacion={null}
        now="2026-08-31T10:00:00.000-05:00"
      />,
    );

    expect(getByText('−$ 1.814.013')).toBeOnTheScreen();
  });

  it('un patrimonio positivo no lleva signo', async () => {
    const { getByText } = await renderWithProviders(
      <OverviewHeader
        patrimonio={money(1_814_013, 'COP')}
        ultimaSincronizacion={null}
        now="2026-08-31T10:00:00.000-05:00"
      />,
    );

    expect(getByText('$ 1.814.013')).toBeOnTheScreen();
  });
});
