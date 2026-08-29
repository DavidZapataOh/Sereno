import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { observability } from '@/infrastructure/observability';
import { ErrorBoundary } from '@/ui/error-boundary';

// Retiene la pantalla de arranque hasta que la app esté montada, para que no
// aparezca un destello en blanco entre el logo y la primera pantalla.
void SplashScreen.preventAutoHideAsync();

/** La composición raíz es donde se cablea la infraestructura con la interfaz. */
function reportarError(error: Error, componentStack: string | null): void {
  observability.captureError(error, { componentStack });
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // OBLIGATORIO junto a `preventAutoHideAsync`: sin esta llamada la pantalla de
  // arranque se queda para siempre y la app parece colgada, sin ningún error en
  // consola. Cuando haya recursos que precargar —las fuentes del sprint 02—,
  // esto pasa a esperar a que estén listos.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary onError={reportarError}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
