import { DARK_PALETTE, LIGHT_PALETTE, type Palette } from './palette';
import { DURATION, ELEVATION, RADIUS, SPACING, TOUCH_TARGET_MIN } from './tokens';
import { FONT_FAMILY, TYPE_SCALE } from './typography';

export type ColorScheme = 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  palette: Palette;
  type: typeof TYPE_SCALE;
  spacing: typeof SPACING;
  radius: typeof RADIUS;
  elevation: typeof ELEVATION;
  duration: typeof DURATION;
  touchTargetMin: typeof TOUCH_TARGET_MIN;
}

export function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    palette: scheme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE,
    type: TYPE_SCALE,
    spacing: SPACING,
    radius: RADIUS,
    elevation: ELEVATION,
    duration: DURATION,
    touchTargetMin: TOUCH_TARGET_MIN,
  };
}

/**
 * La forma del tema de React Navigation, declarada aquí y no importada.
 *
 * Importar `expo-router` desde `ui` arrastra el router entero a cada prueba de
 * componente, y con él un paquete ESM que Jest no transforma. La forma es
 * pública y estable; si cambiara, el `_layout` dejaría de compilar y se vería.
 */
export interface NavigationTheme {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
  };
  fonts: {
    regular: NavigationFont;
    medium: NavigationFont;
    bold: NavigationFont;
    heavy: NavigationFont;
  };
}

interface NavigationFont {
  fontFamily: string;
  fontWeight: '400' | '500' | '600' | '700';
}

/**
 * El mismo tema, en el formato que entiende el navegador de expo-router.
 *
 * Cabeceras y barra de pestañas las pinta React Navigation, no nuestros
 * componentes. Sin este puente usarían sus colores por defecto y la app tendría
 * dos paletas: la nuestra en el contenido y la de la librería alrededor.
 */
export function toNavigationTheme(theme: Theme): NavigationTheme {
  return {
    dark: theme.scheme === 'dark',
    colors: {
      primary: theme.palette.accent,
      background: theme.palette.background,
      card: theme.palette.surface,
      text: theme.palette.textPrimary,
      border: theme.palette.border,
      notification: theme.palette.peligro,
    },
    fonts: {
      regular: { fontFamily: FONT_FAMILY.regular, fontWeight: '400' },
      medium: { fontFamily: FONT_FAMILY.medium, fontWeight: '500' },
      bold: { fontFamily: FONT_FAMILY.semibold, fontWeight: '600' },
      heavy: { fontFamily: FONT_FAMILY.bold, fontWeight: '700' },
    },
  };
}
