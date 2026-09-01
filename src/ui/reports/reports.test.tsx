import type { GastoDeCategoria, GastoDeMes } from '@/application/reports/spending-report';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { CategoryBars, TEXTO_INFORMES } from './category-bars';
import { MonthlyBars } from './monthly-bars';

const COP = 'COP' as const;

const fila = (categoria: string, total: number, porcentaje: number): GastoDeCategoria => ({
  categoria,
  total: money(total, COP),
  porcentaje,
});

const mes = (m: string, total: number): GastoDeMes => ({ mes: m, total: money(total, COP) });

describe('CategoryBars', () => {
  /** Una gráfica sin pregunta escrita es un adorno. */
  it('enseña la pregunta que responde', async () => {
    const { getByText } = await renderWithProviders(
      <CategoryBars filas={[fila('mercado', 600_000, 75)]} />,
    );

    expect(getByText(TEXTO_INFORMES.enQueSeVa)).toBeOnTheScreen();
  });

  /**
   * El color no puede ser lo único que identifique una barra: deja fuera a
   * quien no lo distingue, y aquí lo que se lee es plata.
   */
  it('cada barra dice su categoría y su monto en texto', async () => {
    const { getByText } = await renderWithProviders(
      <CategoryBars filas={[fila('mercado', 600_000, 75)]} />,
    );

    expect(getByText(/mercado/)).toBeOnTheScreen();
    expect(getByText('$ 600.000')).toBeOnTheScreen();
  });

  it('dibuja una barra por categoría', async () => {
    const { getByTestId } = await renderWithProviders(
      <CategoryBars filas={[fila('mercado', 600_000, 75), fila('taxi-y-apps', 200_000, 25)]} />,
    );

    expect(getByTestId('barra-mercado')).toBeOnTheScreen();
    expect(getByTestId('barra-taxi-y-apps')).toBeOnTheScreen();
  });

  it('sin datos lo dice, en vez de dibujar una gráfica vacía', async () => {
    const { getByText } = await renderWithProviders(<CategoryBars filas={[]} />);

    expect(getByText(TEXTO_INFORMES.vacio)).toBeOnTheScreen();
  });
});

describe('MonthlyBars', () => {
  it('enseña la pregunta con la categoría dentro', async () => {
    const { getByText } = await renderWithProviders(
      <MonthlyBars
        categoria="mercado"
        meses={[mes('2026-08', 500_000), mes('2026-09', 600_000)]}
      />,
    );

    expect(getByText(TEXTO_INFORMES.evolucion('mercado'))).toBeOnTheScreen();
  });

  /** Una escala que no arranca en cero y no lo dice miente. */
  it('rotula el mínimo y el máximo', async () => {
    const { getByText } = await renderWithProviders(
      <MonthlyBars
        categoria="mercado"
        meses={[mes('2026-08', 500_000), mes('2026-09', 600_000)]}
      />,
    );

    expect(getByText('$ 500.000')).toBeOnTheScreen();
    expect(getByText('$ 600.000')).toBeOnTheScreen();
  });

  it('dibuja una barra por mes', async () => {
    const { getByTestId } = await renderWithProviders(
      <MonthlyBars
        categoria="mercado"
        meses={[mes('2026-08', 500_000), mes('2026-09', 600_000)]}
      />,
    );

    expect(getByTestId('mes-2026-08')).toBeOnTheScreen();
  });

  /** Un mes solo no es una tendencia, y presentarlo como tal engaña. */
  it('con un solo mes dice que hace falta más historia', async () => {
    const { getByText } = await renderWithProviders(
      <MonthlyBars categoria="mercado" meses={[mes('2026-09', 600_000)]} />,
    );

    expect(getByText(TEXTO_INFORMES.sinHistoria)).toBeOnTheScreen();
  });
});
