import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';

import { SyncSummaryCard } from './sync-summary-card';

describe('SyncSummaryCard', () => {
  const resumen = {
    runId: 'r',
    capturas: 5,
    extraidas: 40,
    nuevas: 12,
    duplicadas: 28,
    fusionadas: 0,
    transferencias: 1,
    conciliacion: null,
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
});
