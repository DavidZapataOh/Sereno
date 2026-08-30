import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { DatabaseProvider } from '@/infrastructure/db/database-provider';
import { useDatabaseBoot } from '@/infrastructure/db/use-database-boot';
import { observability } from '@/infrastructure/observability';
import { ErrorState, LoadingState } from '@/ui/components/states';
import { ErrorBoundary } from '@/ui/error-boundary';
import { toNavigationTheme } from '@/ui/theme/theme';
import { ThemeProvider } from '@/ui/theme/theme-provider';
import { useAppFonts } from '@/ui/theme/typography';
import { useTheme } from '@/ui/theme/use-theme';

// Retiene la pantalla de arranque hasta que las fuentes estén listas, para que
// no aparezca un destello con la fuente del sistema antes de la de la app.
void SplashScreen.preventAutoHideAsync();

/**
 * Cache de consultas. Una importación cambia saldos, movimientos, resumen y
 * conciliación a la vez: invalidar todo en un punto y que cada pantalla se
 * refresque sola es exactamente el problema que esto resuelve.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

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

/**
 * Abre la base y aplica las migraciones antes de mostrar cualquier pantalla.
 *
 * Una pantalla que consulta una tabla que todavía no existe falla con «no such
 * table», que no dice nada de la causa. Si el arranque falla, se dice: quedarse
 * en el logo para siempre —el hallazgo 8 del sprint 01— es lo único peor.
 */
function AppBoot() {
  const theme = useTheme();
  const boot = useDatabaseBoot();

  useEffect(() => {
    if (boot.estado === 'error') {
      observability.captureError(boot.error, { operacion: 'arranque-base-de-datos' });
    }
  }, [boot]);

  if (boot.estado !== 'listo') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.palette.background }}>
        {boot.estado === 'cargando' ? (
          <LoadingState />
        ) : (
          <ErrorState description="No se pudo preparar el almacenamiento. Cierra y vuelve a abrir la aplicación." />
        )}
      </View>
    );
  }

  return (
    <DatabaseProvider db={boot.db}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShadowVisible: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </QueryClientProvider>
    </DatabaseProvider>
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
          <AppBoot />
        </NavigationTheme>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
