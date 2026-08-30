import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';

import { pullFromServer } from '@/application/sync/pull-from-server';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { IconButton } from '@/ui/components/icon-button';
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
  const consulta = useQuery({
    queryKey: ['auto-pull', CURRENT_OWNER],
    queryFn: () => pullFromServer(deps, { owner: CURRENT_OWNER }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const nuevos = consulta.data?.nuevos ?? 0;
  useEffect(() => {
    // Solo si entró algo: invalidar sin motivo redibuja la app entera.
    if (nuevos > 0) void queryClient.invalidateQueries();
  }, [nuevos, queryClient]);
}

export default function TabsLayout() {
  useAutoPull();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.palette.accent,
        tabBarInactiveTintColor: theme.palette.textMuted,
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
              <MaterialCommunityIcons
                name={focused ? pestana.iconActive : pestana.icon}
                size={size}
                color={color}
              />
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
