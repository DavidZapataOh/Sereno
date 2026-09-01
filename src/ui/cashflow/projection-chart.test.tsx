import type { MesProyectado } from '@/domain/cashflow/projection';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { ProjectionChart, TEXTO_PROYECCION } from './projection-chart';

const COP = 'COP' as const;

const mes = (m: string, saldo: number): MesProyectado => ({
  mes: m,
  saldoInicial: money(0, COP),
  comprometido: money(0, COP),
  estimado: money(0, COP),
  saldoFinal: money(saldo, COP),
});

describe('ProjectionChart', () => {
  it('dibuja una barra por mes', async () => {
    const { getByTestId } = await renderWithProviders(
      <ProjectionChart meses={[mes('2026-09', 100), mes('2026-10', 200)]} primerMesEnRojo={null} />,
    );

    expect(getByTestId('barra-2026-09')).toBeOnTheScreen();
    expect(getByTestId('barra-2026-10')).toBeOnTheScreen();
  });

  /** Igual que en `net-worth-chart`: una escala sin rotular puede mentir. */
  it('rotula el mes más bajo, porque la escala no arranca en cero', async () => {
    const { getByText } = await renderWithProviders(
      <ProjectionChart
        meses={[mes('2026-09', 1_800_000), mes('2026-10', 1_850_000)]}
        primerMesEnRojo={null}
      />,
    );

    expect(getByText('$ 1.800.000')).toBeOnTheScreen();
  });

  it('avisa del primer mes en rojo, con palabras', async () => {
    const { getByText } = await renderWithProviders(
      <ProjectionChart meses={[mes('2026-09', -100)]} primerMesEnRojo="2026-09" />,
    );

    expect(getByText(TEXTO_PROYECCION.enRojo('2026-09'))).toBeOnTheScreen();
  });

  /** Sin nada en rojo no se mete miedo: se dice que aguanta. */
  it('sin nada en rojo lo dice, sin alarmar', async () => {
    const { getByText } = await renderWithProviders(
      <ProjectionChart meses={[mes('2026-09', 500_000)]} primerMesEnRojo={null} />,
    );

    expect(getByText(TEXTO_PROYECCION.sinRojo)).toBeOnTheScreen();
  });

  it('sin meses lo dice, en vez de dibujar una gráfica vacía', async () => {
    const { getByText } = await renderWithProviders(
      <ProjectionChart meses={[]} primerMesEnRojo={null} />,
    );

    expect(getByText(TEXTO_PROYECCION.vacio)).toBeOnTheScreen();
  });

  it('un saldo negativo conserva el signo en el rótulo', async () => {
    const { getByText } = await renderWithProviders(
      <ProjectionChart meses={[mes('2026-09', -250_000)]} primerMesEnRojo="2026-09" />,
    );

    expect(getByText('−$ 250.000')).toBeOnTheScreen();
  });
});
