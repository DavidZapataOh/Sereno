import type { Anomaly } from '@/domain/anomalies/anomaly';
import { transactionId } from '@/domain/ledger/ids';
import { renderWithProviders } from '@/test/render';

import { AnomalyCard, TEXTO_ANOMALIA } from './anomaly-card';

const base: Anomaly = {
  id: 'monto-inusual:manual:1',
  tipo: 'monto-inusual',
  transaccion: transactionId('manual:1'),
  explicacion: 'Este cobro es 4.2 veces lo que sueles gastar aquí',
  comparadoCon: 'la mediana de 12 cobros de la misma categoría',
  confianza: 0.6,
};

describe('AnomalyCard', () => {
  it('dice qué pasó', async () => {
    const { getByText } = await renderWithProviders(
      <AnomalyCard anomalia={base} onDescartar={jest.fn()} />,
    );

    expect(getByText(base.explicacion)).toBeOnTheScreen();
  });

  /** Una alerta que no dice contra qué se midió no se puede juzgar. */
  it('dice contra qué se comparó', async () => {
    const { getByText } = await renderWithProviders(
      <AnomalyCard anomalia={base} onDescartar={jest.fn()} />,
    );

    expect(getByText(new RegExp(base.comparadoCon))).toBeOnTheScreen();
  });

  /** No acusa: puede ser normal, y decirlo evita el susto. */
  it('aclara que puede ser normal', async () => {
    const { getByText } = await renderWithProviders(
      <AnomalyCard anomalia={base} onDescartar={jest.fn()} />,
    );

    expect(getByText(TEXTO_ANOMALIA.aclaracion)).toBeOnTheScreen();
    expect(TEXTO_ANOMALIA.aclaracion).not.toMatch(/fraude|robo|peligro|cuidado/i);
  });

  it('se puede descartar', async () => {
    const descartar = jest.fn();
    const { getByText } = await renderWithProviders(
      <AnomalyCard anomalia={base} onDescartar={descartar} />,
    );

    expect(getByText(TEXTO_ANOMALIA.descartar)).toBeOnTheScreen();
  });

  it('cada tipo tiene su título', () => {
    for (const tipo of ['monto-inusual', 'precio-subio', 'cobro-repetido', 'comercio-dormido']) {
      expect(TEXTO_ANOMALIA.titulo[tipo]?.length).toBeGreaterThan(5);
    }
  });
});
