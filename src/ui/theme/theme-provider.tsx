import { createContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { buildTheme, type ColorScheme, type Theme } from './theme';

export const ThemeContext = createContext<Theme | null>(null);

interface Props {
  children: ReactNode;
  /** Fuerza un esquema. Sin esto, se sigue la preferencia del sistema. */
  override?: ColorScheme;
}

/**
 * Proveedor de tema.
 *
 * Sigue al sistema: cuando el usuario cambia a modo oscuro en Android, la app
 * cambia con él sin recargar. La anulación manual persistida llega con la
 * pantalla de ajustes que la expone; hasta entonces no hay dónde elegirla.
 */
export function ThemeProvider({ children, override }: Props) {
  const system = useColorScheme();
  const scheme: ColorScheme = override ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
