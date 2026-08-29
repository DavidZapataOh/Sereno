import { Text } from 'react-native';
import { renderWithProviders } from './render';

describe('renderWithProviders', () => {
  it('renderiza el componente recibido', async () => {
    const { getByText } = await renderWithProviders(<Text>Hola</Text>);
    expect(getByText('Hola')).toBeOnTheScreen();
  });

  it('expone las utilidades de la librería de pruebas', async () => {
    const result = await renderWithProviders(<Text>Hola</Text>);
    expect(typeof result.rerender).toBe('function');
    expect(typeof result.unmount).toBe('function');
  });

  it('los proveedores están montados', async () => {
    const { queryByText } = await renderWithProviders(<Text>Contenido</Text>);
    expect(queryByText('Contenido')).not.toBeNull();
  });
});
