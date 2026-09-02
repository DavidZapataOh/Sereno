import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { marcar } from '@/infrastructure/boot/boot-marks';
import { createExpoHaptics } from '@/infrastructure/haptics/expo-haptics';
import { useCheckpointRefresh } from '@/infrastructure/composition/use-checkpoint-refresh';
import { DatabaseProvider } from '@/infrastructure/db/database-provider';
import { useDatabaseBoot } from '@/infrastructure/db/use-database-boot';
import { observability } from '@/infrastructure/observability';
import { ErrorState, LoadingState } from '@/ui/components/states';
import { ErrorBoundary } from '@/ui/error-boundary';
import { HapticsProvider } from '@/ui/motion/haptics';
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
/** La háptica del sistema, cableada una vez. La interfaz solo ve el puerto. */
const haptics = createExpoHaptics();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Cuánto se guarda lo que ya nadie mira. Estaba en el valor por
      // defecto de la librería, que es una decisión que nadie tomó: con
      // veinte pantallas visitadas, la caché se queda con todo lo consultado
      // —listas de movimientos incluidas— hasta que se cierra la app.
      //
      // Cinco minutos: volver a una pantalla recién visitada sigue siendo
      // instantáneo, y una tarde de uso no deja el historial entero en memoria.
      gcTime: 5 * 60_000,
    },
  },
});

/**
 * Anota que la primera pantalla ya se pinta.
 *
 * Es la última fase del arranque: a partir de aquí el usuario ve algo. Va como
 * componente porque el momento que interesa es el del montaje, no el de la
 * decisión de montar.
 */
function PrimeraPantalla(): null {
  useEffect(() => {
    marcar('primera-pantalla');
  }, []);
  return null;
}

/** Pone al día los cortes de saldo sin pintar nada. */
function CheckpointRefresh(): null {
  useCheckpointRefresh();
  return null;
}

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
        {/* Los cortes de saldo se ponen al día en segundo plano: no retrasan
            la primera pantalla, y si fallan la app calcula igual. */}
        <CheckpointRefresh />
        <PrimeraPantalla />
        {/* Una sola transición en todo el árbol: el cerebro construye un mapa
            del sitio, y para eso las pantallas tienen que entrar siempre por
            el mismo lado. */}
        <Stack screenOptions={{ headerShadowVisible: false, animation: 'slide_from_right' }}>
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
    if (fuentesListas) {
      marcar('fuentes');
      void SplashScreen.hideAsync();
    }
  }, [fuentesListas]);

  if (!fuentesListas) return null;

  return (
    <ErrorBoundary onError={reportarError}>
      <ThemeProvider>
        <HapticsProvider value={haptics}>
          <NavigationTheme>
            <AppBoot />
          </NavigationTheme>
        </HapticsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
