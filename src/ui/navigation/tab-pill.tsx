import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/ui/motion/use-reduced-motion';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  activa: boolean;
  children: ReactNode;
}

/**
 * La cápsula que marca la pestaña activa.
 *
 * **El color solo aparece para comunicar estado**, que es la regla de
 * `colors.txt` sobre los iconos: un icono no lleva color propio; lo lleva
 * cuando está activo. La cápsula ámbar es exactamente eso —el 10 % de la
 * paleta, en el único sitio donde hay algo que decir— y crece con muelle para
 * que el cambio de pestaña se sienta y no solo se vea.
 */
export function TabPill({ activa, children }: Props) {
  const theme = useTheme();
  const reducido = useReducedMotion();

  const animado = useAnimatedStyle(() =>
    reducido
      ? { opacity: activa ? 1 : 0, transform: [{ scale: 1 }] }
      : {
          opacity: withTiming(activa ? 1 : 0, { duration: theme.motion.duracion.instante }),
          transform: [{ scale: withSpring(activa ? 1 : 0.7, theme.motion.resorte.entrada) }],
        },
  );

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: theme.spacing.xxl + theme.spacing.md,
            height: theme.spacing.xl + theme.spacing.xs,
            borderRadius: theme.radius.completo,
            backgroundColor: theme.palette.accentSoft,
          },
          animado,
        ]}
      />
      {children}
    </View>
  );
}
