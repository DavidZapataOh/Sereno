import { ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import type { Snapshot } from '@/domain/overview/snapshot';
import { renderWithProviders } from '@/test/render';

import { NetWorthChart, TEXTO_EVOLUCION } from './net-worth-chart';

const owner = ownerId('david');

const punto = (dia: string, amount: bigint): Snapshot => ({
  owner,
  dia,
  patrimonio: money(amount, 'COP'),
  tasas: 'TRM oficial',
  tomadaEn: `${dia}T10:00:00.000-05:00`,
});

describe('NetWorthChart', () => {
  it('sin historia lo dice, y dice cuándo habrá', async () => {
    const { getByText } = await renderWithProviders(<NetWorthChart serie={[]} />);

    expect(getByText(TEXTO_EVOLUCION.vacio)).toBeOnTheScreen();
    expect(getByText(TEXTO_EVOLUCION.vacioAyuda)).toBeOnTheScreen();
  });

  it('dibuja una barra por día', async () => {
    const { getByTestId } = await renderWithProviders(
      <NetWorthChart serie={[punto('2026-08-30', 100n), punto('2026-08-31', 200n)]} />,
    );

    expect(getByTestId('barra-2026-08-30')).toBeOnTheScreen();
    expect(getByTestId('barra-2026-08-31')).toBeOnTheScreen();
  });

  /**
   * La escala no arranca en cero —entre 1,80 y 1,85 millones todas las barras
   * se verían iguales—, así que hay que rotular los extremos. Una escala que no
   * arranca en cero y no lo dice es la forma clásica de mentir con una gráfica.
   */
  it('rotula el mínimo y el máximo, porque la escala no arranca en cero', async () => {
    const { getByText } = await renderWithProviders(
      <NetWorthChart serie={[punto('2026-08-30', 1_800_000n), punto('2026-08-31', 1_850_000n)]} />,
    );

    expect(getByText('$ 1.800.000')).toBeOnTheScreen();
    expect(getByText('$ 1.850.000')).toBeOnTheScreen();
  });

  /** Un solo punto no es una tendencia, y presentarlo como tal engaña. */
  it('con un solo día avisa de que no hay tendencia', async () => {
    const { getByText } = await renderWithProviders(
      <NetWorthChart serie={[punto('2026-08-31', 100n)]} />,
    );

    expect(getByText(TEXTO_EVOLUCION.unSoloDia)).toBeOnTheScreen();
  });

  /**
   * Los días sin marca se declaran en vez de disimularse. Unir dos puntos
   * sobre un hueco dibuja una evolución que nadie midió.
   */
  it('dice cuántos días faltan cuando la app no se abrió', async () => {
    const { getByText } = await renderWithProviders(
      <NetWorthChart serie={[punto('2026-08-28', 100n), punto('2026-08-31', 200n)]} />,
    );

    expect(getByText(new RegExp(TEXTO_EVOLUCION.hueco))).toBeOnTheScreen();
  });

  it('sin huecos no molesta con el aviso', async () => {
    const { queryByText } = await renderWithProviders(
      <NetWorthChart serie={[punto('2026-08-30', 100n), punto('2026-08-31', 200n)]} />,
    );

    expect(queryByText(new RegExp(TEXTO_EVOLUCION.hueco))).toBeNull();
  });

  /** Todos iguales no es «cero»: es plano, y tiene que verse plano. */
  it('una serie sin variación no deja las barras en cero', async () => {
    const { getByTestId } = await renderWithProviders(
      <NetWorthChart serie={[punto('2026-08-30', 500n), punto('2026-08-31', 500n)]} />,
    );

    const barra = getByTestId('barra-2026-08-31');
    expect((barra.props as { style: { height: number } }).style.height).toBeGreaterThan(2);
  });

  /** Sprint 07, hallazgo 17: que no se pierda el menos al tocar esta pantalla. */
  it('un patrimonio negativo conserva el signo en los rótulos', async () => {
    const { getAllByText } = await renderWithProviders(
      <NetWorthChart serie={[punto('2026-08-31', -1_814_013n)]} />,
    );

    // Dos veces: con un solo punto, el mínimo y el máximo son el mismo.
    expect(getAllByText('−$ 1.814.013')).toHaveLength(2);
  });
});
