import { useEffect, type ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/ui/motion/use-reduced-motion';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  /** Qué puesto ocupa en la secuencia. El primero entra ya; los demás esperan. */
  orden?: number;
  children: ReactNode;
}

/**
 * Algo que entra en escena, en su turno.
 *
 * **De uno en uno y no de golpe.** La misma información entregada a la vez
 * produce un solo momento; entregada en secuencia produce uno por pieza, y cada
 * una se lee de verdad en vez de perderse en el bloque. Es la diferencia entre
 * un recibo y un regalo.
 *
 * El retraso entre piezas es corto a propósito: esto acompaña una lectura, no
 * la retrasa. Con «reducir movimiento» aparece todo a la vez, ya visible.
 */
export function Reveal({ orden = 0, children }: Props) {
  const theme = useTheme();
  const reducido = useReducedMotion();
  const avance = useSharedValue(reducido ? 1 : 0);

  useEffect(() => {
    if (reducido) {
      avance.value = 1;
      return;
    }
    avance.value = withDelay(
      orden * theme.motion.duracion.instante,
      withSpring(1, theme.motion.resorte.entrada),
    );
  }, [avance, orden, reducido, theme.motion.duracion.instante, theme.motion.resorte.entrada]);

  const animado = useAnimatedStyle(() => ({
    opacity: reducido ? 1 : withTiming(avance.value, { duration: theme.motion.duracion.rapido }),
    transform: [{ translateY: (1 - avance.value) * theme.spacing.lg }],
  }));

  return <Animated.View style={animado}>{children}</Animated.View>;
}
