import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DARK_PALETTE, LIGHT_PALETTE } from './palette';
import { buildTheme, toNavigationTheme } from './theme';
import { ThemeProvider } from './theme-provider';
import { useTheme } from './use-theme';

function Sonda() {
  const theme = useTheme();
  return (
    <>
      <Text testID="fondo">{theme.palette.background}</Text>
      <Text testID="esquema">{theme.scheme}</Text>
      <Text testID="espacio">{String(theme.spacing.lg)}</Text>
    </>
  );
}

// No se usa `renderWithProviders`: ese ayudante ya incluye el ThemeProvider, y
// montarlo dentro de sí mismo impediría probar el caso sin proveedor.
describe('ThemeProvider', () => {
  it('usa el tema claro cuando se fuerza', async () => {
    await render(
      <ThemeProvider override="light">
        <Sonda />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('fondo')).toHaveTextContent(LIGHT_PALETTE.background);
    expect(screen.getByTestId('esquema')).toHaveTextContent('light');
  });

  it('usa el tema oscuro cuando se fuerza', async () => {
    await render(
      <ThemeProvider override="dark">
        <Sonda />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('fondo')).toHaveTextContent(DARK_PALETTE.background);
    expect(screen.getByTestId('esquema')).toHaveTextContent('dark');
  });

  it('expone los tokens junto a la paleta', async () => {
    await render(
      <ThemeProvider override="light">
        <Sonda />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('espacio')).toHaveTextContent('16');
  });

  it('useTheme falla fuera del proveedor, en vez de devolver algo silencioso', async () => {
    // React vuelca el error por consola además de lanzarlo; se silencia para
    // que la salida de la prueba no parezca un fallo. `restoreMocks` lo repone.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    // `render` es asíncrona: el fallo llega como promesa rechazada, no como
    // excepción síncrona.
    await expect(render(<Sonda />)).rejects.toThrow(/ThemeProvider/);
  });
});

describe('toNavigationTheme', () => {
  it('lleva la paleta a las cabeceras y la barra de pestañas', () => {
    const nav = toNavigationTheme(buildTheme('dark'));

    expect(nav.dark).toBe(true);
    expect(nav.colors.background).toBe(DARK_PALETTE.background);
    expect(nav.colors.card).toBe(DARK_PALETTE.surface);
    expect(nav.colors.text).toBe(DARK_PALETTE.textPrimary);
    expect(nav.colors.primary).toBe(DARK_PALETTE.accent);
    expect(nav.colors.border).toBe(DARK_PALETTE.border);
  });

  it('en claro no marca el tema como oscuro', () => {
    expect(toNavigationTheme(buildTheme('light')).dark).toBe(false);
  });

  it('usa la fuente de la app en las cabeceras', () => {
    // Sin esto, el título de la pantalla saldría en la fuente del sistema y el
    // contenido en Inter: dos tipografías en la misma pantalla.
    expect(toNavigationTheme(buildTheme('light')).fonts.regular.fontFamily).toBe(
      'Inter_400Regular',
    );
  });
});
