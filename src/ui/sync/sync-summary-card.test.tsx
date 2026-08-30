import { fireEvent } from '@testing-library/react-native';

import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { SyncSummaryCard } from './sync-summary-card';

const resumenOwner = ownerId('local');

describe('SyncSummaryCard', () => {
  const resumen = {
    runId: 'r',
    capturas: 5,
    extraidas: 40,
    nuevas: 12,
    duplicadas: 28,
    fusionadas: 0,
    omitidas: 0,
    motivosOmision: [],
    anteriores: 0,
    desde: null,
    transferencias: 1,
    conciliacion: null,
    saldoInicial: null,
  };

  it('resume en lenguaje llano y se puede cerrar', async () => {
    const onDismiss = jest.fn();
    const { getByText, getByRole } = await renderWithProviders(
      <SyncSummaryCard summary={resumen} onDismiss={onDismiss} />,
    );
    expect(getByText('12 movimientos nuevos')).toBeOnTheScreen();
    expect(getByText('1 transferencia detectada')).toBeOnTheScreen();
    expect(getByText('28 ya estaban')).toBeOnTheScreen();
    await fireEvent.press(getByRole('button', { name: 'Cerrar' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('con cero nuevos lo dice sin dramatizar', async () => {
    const { getByText } = await renderWithProviders(
      <SyncSummaryCard
        summary={{ ...resumen, nuevas: 0, transferencias: 0 }}
        onDismiss={() => undefined}
      />,
    );
    expect(getByText('Nada nuevo desde la última vez')).toBeOnTheScreen();
  });

  it('cuenta las filas omitidas para que no pasen en silencio', async () => {
    const { getByText } = await renderWithProviders(
      <SyncSummaryCard summary={{ ...resumen, omitidas: 1 }} onDismiss={() => undefined} />,
    );
    expect(getByText('1 fila sin monto, omitida')).toBeOnTheScreen();
  });

  it('en la primera sincronización dice qué saldo inicial fijó', async () => {
    const { getByText } = await renderWithProviders(
      <SyncSummaryCard
        summary={{ ...resumen, saldoInicial: money(735000, 'COP') }}
        onDismiss={() => undefined}
      />,
    );
    expect(getByText(/Saldo inicial fijado en \$ 735\.000/)).toBeOnTheScreen();
  });

  it('sin saldo del banco lo dice y explica cómo conseguirlo', async () => {
    const { getByText } = await renderWithProviders(
      <SyncSummaryCard summary={resumen} onDismiss={() => undefined} />,
    );
    expect(getByText(/No vi el saldo del banco/)).toBeOnTheScreen();
  });

  it('con saldo del banco muestra la cifra que usó y si cuadra', async () => {
    const { getByText } = await renderWithProviders(
      <SyncSummaryCard
        summary={{
          ...resumen,
          conciliacion: {
            id: 'r1',
            owner: resumenOwner,
            accountId: accountId('bancolombia:ahorros'),
            fecha: '2026-08-28T10:00:00.000-05:00',
            saldoReal: money(700000, 'COP'),
            saldoCalculado: money(700000, 'COP'),
            diferencia: money(0, 'COP'),
            veredicto: 'cuadra',
            fuente: 'bancolombia',
            detalle: 'Ahorros ****8901',
            creadoEn: '2026-08-28T10:00:00.000-05:00',
          },
        }}
        onDismiss={() => undefined}
      />,
    );
    expect(getByText(/Saldo del banco: \$ 700\.000 \(Ahorros \*\*\*\*8901\)/)).toBeOnTheScreen();
    expect(getByText(/Cuadra con lo que Sereno tiene/)).toBeOnTheScreen();
  });

  it('dice cuántos movimientos quedaron antes del inicio y desde qué día cuenta', async () => {
    const { getByText } = await renderWithProviders(
      <SyncSummaryCard
        summary={{ ...resumen, anteriores: 23, desde: '2026-08-29' }}
        onDismiss={() => undefined}
      />,
    );
    expect(getByText(/23 movimientos anteriores al 29 ago no cuentan/)).toBeOnTheScreen();
  });
});
