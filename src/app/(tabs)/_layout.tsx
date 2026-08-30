import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

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

export default function TabsLayout() {
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
