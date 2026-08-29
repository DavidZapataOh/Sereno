import { Text } from 'react-native';
import { ErrorBoundary } from './error-boundary';
import { renderWithProviders } from '@/test/render';

function Explota(): never {
  throw new Error('fallo de renderizado');
}

describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    // React escribe el error en consola aunque el boundary lo atrape.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('muestra a sus hijos cuando no hay error', async () => {
    const { getByText } = await renderWithProviders(
      <ErrorBoundary>
        <Text>Contenido</Text>
      </ErrorBoundary>,
    );
    expect(getByText('Contenido')).toBeOnTheScreen();
  });

  it('muestra el mensaje de respaldo cuando un hijo falla', async () => {
    const { getByText } = await renderWithProviders(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>,
    );
    expect(getByText('Algo salió mal')).toBeOnTheScreen();
  });

  it('reporta el error a quien se le inyecte', async () => {
    const onError = jest.fn();
    await renderWithProviders(
      <ErrorBoundary onError={onError}>
        <Explota />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('fallo de renderizado');
  });

  it('funciona sin reportero, sin lanzar', async () => {
    const { getByText } = await renderWithProviders(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>,
    );
    expect(getByText('Algo salió mal')).toBeOnTheScreen();
  });

  it('no muestra el detalle técnico del error al usuario', async () => {
    const { queryByText } = await renderWithProviders(
      <ErrorBoundary>
        <Explota />
      </ErrorBoundary>,
    );
    expect(queryByText(/fallo de renderizado/)).toBeNull();
  });
});
