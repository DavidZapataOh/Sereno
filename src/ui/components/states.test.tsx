import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';

import { EmptyState, ErrorState, LoadingState } from './states';

describe('LoadingState', () => {
  it('anuncia que está cargando', async () => {
    const { getByLabelText } = await renderWithProviders(<LoadingState />);
    expect(getByLabelText('Cargando')).toBeOnTheScreen();
  });
});

describe('EmptyState', () => {
  it('muestra el título y la descripción', async () => {
    const { getByText } = await renderWithProviders(
      <EmptyState title="Sin movimientos" description="Todavía no hay nada por aquí." />,
    );
    expect(getByText('Sin movimientos')).toBeOnTheScreen();
    expect(getByText('Todavía no hay nada por aquí.')).toBeOnTheScreen();
  });

  it('puede ofrecer una acción', async () => {
    const onAction = jest.fn();
    const { getByRole } = await renderWithProviders(
      <EmptyState
        title="Sin cuentas"
        description="Conecta una para empezar."
        action={{ label: 'Conectar', onPress: onAction }}
      />,
    );
    await fireEvent.press(getByRole('button'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorState', () => {
  it('muestra la descripción del problema', async () => {
    const { getByText } = await renderWithProviders(
      <ErrorState description="No pudimos sincronizar." onRetry={() => undefined} />,
    );
    expect(getByText('No pudimos sincronizar.')).toBeOnTheScreen();
  });

  it('ofrece reintentar', async () => {
    const onRetry = jest.fn();
    const { getByRole } = await renderWithProviders(
      <ErrorState description="Falló." onRetry={onRetry} />,
    );
    await fireEvent.press(getByRole('button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('no ofrece reintentar cuando no hay acción posible', async () => {
    const { queryByRole } = await renderWithProviders(<ErrorState description="Falló." />);
    expect(queryByRole('button')).toBeNull();
  });

  it('no muestra detalles técnicos del error', async () => {
    const { queryByText } = await renderWithProviders(
      <ErrorState description="No pudimos sincronizar." />,
    );
    expect(queryByText(/stack|TypeError|undefined/i)).toBeNull();
  });

  it('el título no alarma: informa', async () => {
    // Principio 3. Sin signos de admiración ni mayúsculas.
    const { getByText } = await renderWithProviders(<ErrorState description="Falló." />);
    expect(getByText('Algo no salió bien')).toBeOnTheScreen();
  });
});
