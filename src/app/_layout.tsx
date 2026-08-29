import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { observability } from '@/infrastructure/observability';
import { ErrorBoundary } from '@/ui/error-boundary';

// `void` marca explícitamente que la promesa se ignora a propósito: la pantalla
// de arranque se oculta sola cuando la app monta.
void SplashScreen.preventAutoHideAsync();

/** La composición raíz es donde se cablea la infraestructura con la interfaz. */
function reportarError(error: Error, componentStack: string | null): void {
  observability.captureError(error, { componentStack });
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary onError={reportarError}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
