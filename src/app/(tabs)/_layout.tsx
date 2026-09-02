import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';

import { syncExchange } from '@/application/crypto/sync-exchange';
import { syncWallets } from '@/application/crypto/sync-wallets';
import { rescheduleReminders } from '@/application/alerts/reschedule-reminders';
import { recordSnapshot } from '@/application/overview/record-snapshot';
import { refreshRates } from '@/application/rates/refresh-rates';
import { pullFromServer } from '@/application/sync/pull-from-server';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { observability } from '@/infrastructure/observability';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { IconButton } from '@/ui/components/icon-button';
import { TabPill } from '@/ui/navigation/tab-pill';
import { useArrivalStore } from '@/ui/sync/arrival-store';
import { useTheme } from '@/ui/theme/use-theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Cuatro pestañas, cuatro preguntas. Ver `domain/navigation/screen-map.ts`.
 *
 * Iconos de trazo con el activo relleno, etiqueta siempre visible: es el patrón
 * de Android. Los iconos no llevan color propio; el color lo pone el estado
 * (activo o no).
 */
const PESTANAS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Hoy', icon: 'home-variant-outline', iconActive: 'home-variant' },
  {
    name: 'movimientos',
    title: 'Movimientos',
    icon: 'swap-horizontal',
    iconActive: 'swap-horizontal-bold',
  },
  { name: 'deudas', title: 'Deudas', icon: 'credit-card-outline', iconActive: 'credit-card' },
  { name: 'metas', title: 'Metas', icon: 'flag-outline', iconActive: 'flag' },
];

/**
 * Trae del servidor al abrir la app.
 *
 * `useQuery` y no `useMutation` porque TanStack Query ya sabe reintentar, no
 * repetir si acaba de hacerlo, y quedarse callado sin conexión. Si falla, no
 * se muestra nada aquí: la app funciona con lo que ya tiene en SQLite y el
 * estado se ve en Ajustes.
 */
function useAutoPull(): void {
  const deps = useAppDeps();
  const queryClient = useQueryClient();
  const anunciar = useArrivalStore((estado) => estado.anunciar);
  const consulta = useQuery({
    queryKey: ['auto-pull', CURRENT_OWNER],
    queryFn: () => pullFromServer(deps, { owner: CURRENT_OWNER }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const nuevos = consulta.data?.nuevos ?? 0;
  useEffect(() => {
    // Solo si entró algo: invalidar sin motivo redibuja la app entera.
    if (nuevos > 0) {
      void queryClient.invalidateQueries();
      // Y se anuncia: es el momento de la mañana, y hasta ahora la lista
      // crecía en silencio.
      anunciar(nuevos, deps.clock());
    }
  }, [anunciar, deps, nuevos, queryClient]);
}

/**
 * Lee las wallets y Binance, y refresca las tasas, al abrir.
 *
 * Las wallets y la TRM no dependen del servidor —los nodos y datos.gov.co son
 * públicos—, así que funcionan aunque no haya backend. Los saldos de Binance
 * sí lo necesitan, porque las claves viven ahí; van al final y su fallo no
 * impide lo demás.
 *
 * Primero las tasas y después los saldos: valorar en pesos con una tasa de
 * hace una semana da una cifra que parece buena y no lo es.
 */
function useAutoCrypto(): void {
  const deps = useAppDeps();
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ['auto-crypto', CURRENT_OWNER],
    queryFn: async () => {
      await refreshRates(deps);
      const wallets = await syncWallets(deps, { owner: CURRENT_OWNER });
      // Binance va después y aparte: si el servidor no está configurado o no
      // responde, las wallets ya quedaron leídas. Un fallo de uno no puede
      // dejar al otro sin sincronizar.
      const exchange = await syncExchange(deps, { owner: CURRENT_OWNER });
      // Nada de esto se traga en silencio. Cuando el error de Binance se
      // descartaba aquí, las claves no estaban en Railway y no había forma de
      // enterarse sin consultar el servidor a mano.
      if (exchange.estado !== 'ok') {
        observability.log('warn', 'Binance no se pudo leer', { estado: exchange.estado });
      }
      for (const cadena of wallets.fallidas) {
        observability.log('warn', 'cadena no leída', { cadena });
      }
      // La marca del día se toma **después** de leer todo, no antes: si no,
      // guardaría el patrimonio de ayer con fecha de hoy.
      await recordSnapshot(deps, { owner: CURRENT_OWNER });
      // Los avisos se reprograman **al final**, con la contabilidad ya al día:
      // hacerlo antes avisaría de algo que se acaba de pagar. Y se reprograman
      // enteros porque en Android no sobreviven a un reinicio del teléfono.
      const avisos = await rescheduleReminders(deps, { owner: CURRENT_OWNER });
      if (avisos.motivo !== 'ok') {
        observability.log('info', 'avisos no programados', { motivo: avisos.motivo });
      }
      return { ajustes: wallets.ajustes + exchange.ajustes };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const ajustes = consulta.data?.ajustes ?? 0;
  useEffect(() => {
    // Solo si algún saldo cambió: invalidar sin motivo redibuja la app entera.
    if (ajustes > 0) void queryClient.invalidateQueries();
  }, [ajustes, queryClient]);
}

export default function TabsLayout() {
  useAutoPull();
  useAutoCrypto();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.palette.accent,
        tabBarInactiveTintColor: theme.palette.textMuted,
        // Las transiciones entre pestañas se deslizan: no se cambia de
        // pantalla, se navega. Es lo que construye el mapa mental de dónde
        // está cada cosa.
        animation: 'shift',
        tabBarStyle: {
          backgroundColor: theme.palette.surface,
          borderTopColor: theme.palette.border,
          // El área táctil de una pestaña nunca baja del mínimo de Android.
          minHeight: theme.touchTargetMin + theme.spacing.md,
        },
        tabBarLabelStyle: {
          fontFamily: theme.type.micro.fontFamily,
          fontSize: theme.type.micro.fontSize,
        },
        headerShadowVisible: false,
      }}
    >
      {PESTANAS.map((pestana) => (
        <Tabs.Screen
          key={pestana.name}
          name={pestana.name}
          options={{
            title: pestana.title,
            tabBarIcon: ({ focused, color, size }) => (
              <TabPill activa={focused}>
                <MaterialCommunityIcons
                  name={focused ? pestana.iconActive : pestana.icon}
                  size={size}
                  color={color}
                />
              </TabPill>
            ),
            // Los ajustes cuelgan de «Hoy»: se visitan una vez al mes y no
            // merecen un cuarto de la barra.
            ...(pestana.name === 'index'
              ? {
                  headerRight: () => (
                    <IconButton
                      icon="cog-outline"
                      label="Ajustes"
                      onPress={() => {
                        router.push('/ajustes');
                      }}
                    />
                  ),
                }
              : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
