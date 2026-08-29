import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';

import { observability } from '@/infrastructure/observability';
import { ErrorBoundary } from '@/ui/error-boundary';
import { toNavigationTheme } from '@/ui/theme/theme';
import { ThemeProvider } from '@/ui/theme/theme-provider';
import { useAppFonts } from '@/ui/theme/typography';
import { useTheme } from '@/ui/theme/use-theme';

// Retiene la pantalla de arranque hasta que las fuentes estén listas, para que
// no aparezca un destello con la fuente del sistema antes de la de la app.
void SplashScreen.preventAutoHideAsync();

/** La composición raíz es donde se cablea la infraestructura con la interfaz. */
function reportarError(error: Error, componentStack: string | null): void {
  observability.captureError(error, { componentStack });
}

/**
 * Lleva nuestro tema al navegador.
 *
 * Va dentro de nuestro `ThemeProvider` porque necesita leerlo, y envuelve al
 * `Stack` porque cabeceras y pestañas las pinta React Navigation.
 */
function NavigationTheme({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <NavigationThemeProvider value={toNavigationTheme(theme)}>{children}</NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const fuentesListas = useAppFonts();

  // OBLIGATORIO junto a `preventAutoHideAsync`: sin esta llamada la pantalla de
  // arranque se queda para siempre y la app parece colgada, sin ningún error en
  // consola. `useAppFonts` devuelve `true` también si la carga falla, así que
  // esto siempre acaba ejecutándose.
  useEffect(() => {
    if (fuentesListas) void SplashScreen.hideAsync();
  }, [fuentesListas]);

  if (!fuentesListas) return null;

  return (
    <ErrorBoundary onError={reportarError}>
      <ThemeProvider>
        <NavigationTheme>
          <Stack />
        </NavigationTheme>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
