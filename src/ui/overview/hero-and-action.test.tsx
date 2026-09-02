import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { DestinationGrid } from './destination-grid';
import { NetWorthHero, TEXTO_HERO } from './net-worth-hero';
import { NextActionCard, TEXTO_ACCION } from './next-action-card';

const AHORA = '2026-09-02T10:00:00.000-05:00';

describe('NetWorthHero', () => {
  it('el patrimonio es lo que se anuncia, y con su cifra', async () => {
    const { getByLabelText } = await renderWithProviders(
      <NetWorthHero
        patrimonio={money(3_450_000n, 'COP')}
        ultimaSincronizacion={AHORA}
        now={AHORA}
      />,
    );

    expect(getByLabelText('Tienes 3.450.000 pesos')).toBeOnTheScreen();
  });

  /** Sprint 08: lo que no se pudo valorar se dice, no se calla. */
  it('lo que no se pudo valorar se sigue declarando', async () => {
    const { getByText } = await renderWithProviders(
      <NetWorthHero
        patrimonio={money(1n, 'COP')}
        sinValorar={[money(5n, 'USDC')]}
        ultimaSincronizacion={AHORA}
        now={AHORA}
      />,
    );

    expect(getByText(TEXTO_HERO.sinValorar)).toBeOnTheScreen();
  });

  it('sin sincronizar nunca, lo dice en vez de callar', async () => {
    const { getByText } = await renderWithProviders(
      <NetWorthHero patrimonio={money(0n, 'COP')} ultimaSincronizacion={null} now={AHORA} />,
    );

    expect(getByText(TEXTO_HERO.nunca)).toBeOnTheScreen();
  });
});

describe('NextActionCard', () => {
  it('con pendientes, dice cuántos y ofrece una sola acción', async () => {
    const onClasificar = jest.fn();
    const { getByText, getAllByRole } = await renderWithProviders(
      <NextActionCard pendientes={7} onClasificar={onClasificar} />,
    );

    expect(getByText(TEXTO_ACCION.pendientes(7))).toBeOnTheScreen();
    expect(getAllByRole('button')).toHaveLength(1);
  });

  /** Ni felicita ni regaña: constata que está hecho. */
  it('sin pendientes cierra el día, sin premios ni reproches', async () => {
    const { getByText, queryAllByRole } = await renderWithProviders(
      <NextActionCard pendientes={0} onClasificar={jest.fn()} />,
    );

    expect(getByText(TEXTO_ACCION.alDia)).toBeOnTheScreen();
    expect(queryAllByRole('button')).toHaveLength(0);
    expect(TEXTO_ACCION.alDiaAyuda).not.toMatch(/felicidades|racha|perdiste|¡/i);
  });

  it('uno solo se dice en singular', () => {
    expect(TEXTO_ACCION.pendientes(1)).toBe('1 movimiento sin clasificar');
  });
});

describe('DestinationGrid', () => {
  it('cada destino es un pulsable con su nombre', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <DestinationGrid
        destinos={[
          { titulo: 'Informes', icono: 'chart-box-outline', onPress },
          { titulo: 'Avisos', icono: 'bell-outline', onPress },
        ]}
      />,
    );

    expect(getByLabelText('Informes')).toBeOnTheScreen();
    expect(getByLabelText('Avisos')).toBeOnTheScreen();
  });
});
