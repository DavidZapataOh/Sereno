import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { OverviewHeader, TEXTO_OVERVIEW } from './overview-header';

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

describe('saldos sin valorar', () => {
  /**
   * Un total que calla lo que no supo valorar miente por omisión, y se ve
   * perfectamente bien.
   */
  it('lo dice cuando hay saldo que no se pudo pasar a pesos', async () => {
    const { getByText } = await renderWithProviders(
      <OverviewHeader
        patrimonio={money(80_000, 'COP')}
        sinValorar={[money(85_761n, 'USDC')]}
        ultimaSincronizacion={null}
        now="2026-08-31T10:00:00.000-05:00"
      />,
    );

    expect(getByText(TEXTO_OVERVIEW.sinValorar)).toBeOnTheScreen();
  });

  it('sin nada pendiente, no ensucia la pantalla con el aviso', async () => {
    const { queryByText } = await renderWithProviders(
      <OverviewHeader
        patrimonio={money(80_000, 'COP')}
        sinValorar={[]}
        ultimaSincronizacion={null}
        now="2026-08-31T10:00:00.000-05:00"
      />,
    );

    expect(queryByText(TEXTO_OVERVIEW.sinValorar)).toBeNull();
  });
});
