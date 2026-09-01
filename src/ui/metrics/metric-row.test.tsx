import type { Metrica } from '@/domain/metrics/behavior';
import { renderWithProviders } from '@/test/render';

import { MetricRow, TEXTO_METRICAS } from './metric-row';

const base: Metrica = {
  clave: 'antiguedad-del-dinero',
  valor: 34,
  unidad: 'dias',
  meses: 3,
  queLaMueve: 'Sube si aumentas el colchón o si un mes gastas menos de lo que entra',
};

describe('MetricRow', () => {
  it('enseña el número con su unidad', async () => {
    const { getByText } = await renderWithProviders(<MetricRow metrica={base} />);

    expect(getByText('34 días')).toBeOnTheScreen();
  });

  it('explica qué significa la medida', async () => {
    const { getByText } = await renderWithProviders(<MetricRow metrica={base} />);

    expect(getByText(TEXTO_METRICAS.que['antiguedad-del-dinero'] ?? '')).toBeOnTheScreen();
  });

  /** Un número solo no sirve: hay que saber qué lo movería. */
  it('enseña qué la movería', async () => {
    const { getByText } = await renderWithProviders(<MetricRow metrica={base} />);

    expect(getByText(new RegExp(TEXTO_METRICAS.queLaMueve))).toBeOnTheScreen();
  });

  it('dice sobre cuántos meses se calculó', async () => {
    const { getByText } = await renderWithProviders(<MetricRow metrica={base} />);

    expect(getByText(TEXTO_METRICAS.sobre(3))).toBeOnTheScreen();
  });

  it('una tasa negativa se enseña negativa', async () => {
    const { getByText } = await renderWithProviders(
      <MetricRow
        metrica={{ ...base, clave: 'tasa-de-ahorro', unidad: 'porcentaje', valor: -30 }}
      />,
    );

    expect(getByText('-30 %')).toBeOnTheScreen();
  });

  /** Son medidas, no notas. */
  it('ningún texto califica al usuario', () => {
    const todos = [
      TEXTO_METRICAS.explicacion,
      ...Object.values(TEXTO_METRICAS.que),
      ...Object.values(TEXTO_METRICAS.titulo),
    ].join(' ');

    expect(todos).not.toMatch(/deberías|tienes que|felicidades|mal hecho|vas mal/i);
  });
});
