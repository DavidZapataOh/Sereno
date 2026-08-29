import { useContext } from 'react';

import type { Theme } from './theme';
import { ThemeContext } from './theme-provider';

/**
 * Acceso al tema.
 *
 * Lanza fuera del proveedor en vez de devolver un tema por defecto: un
 * componente que se pinta con colores de repuesto sin avisar es un fallo que
 * nadie nota hasta que se ve raro en producción.
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error('useTheme debe usarse dentro de un ThemeProvider');
  }
  return theme;
}
