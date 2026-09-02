import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/ui/motion/use-reduced-motion';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  /** Alto de la pieza. El ancho lo decide quien la coloca. */
  alto?: number;
  ancho?: number | `${number}%`;
  radio?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Una pieza de esqueleto.
 *
 * **Con la forma de lo que va a aparecer**, no un rectángulo genérico: una
 * lista de movimientos carga como una lista de movimientos, y así el espacio de
 * espera deja de ser espacio muerto y pasa a decir qué viene.
 *
 * **Sin barrido de brillo.** Es la animación decorativa por excelencia y a la
 * tercera semana cansa; basta una opacidad que respira, que además cuesta menos.
 */
export function Skeleton({ alto = 16, ancho = '100%', radio, style }: Props) {
  const theme = useTheme();
  const reducido = useReducedMotion();
  const opacidad = useSharedValue(1);

  useEffect(() => {
    opacidad.value = reducido
      ? 1
      : withRepeat(withTiming(0.45, { duration: theme.motion.duracion.entrada }), -1, true);
  }, [opacidad, reducido, theme.motion.duracion.entrada]);

  const animado = useAnimatedStyle(() => ({ opacity: opacidad.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height: alto,
          width: ancho,
          borderRadius: radio ?? theme.radius.pequeno,
          backgroundColor: theme.palette.surfaceSunken,
        },
        style,
        animado,
      ]}
    />
  );
}

/**
 * Un esqueleto de fila: avatar, dos líneas y un monto a la derecha.
 *
 * Es la forma de casi todas las listas de esta app, así que existe una vez en
 * vez de dibujarse en cada pantalla.
 */
export function SkeletonRow() {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
      }}
    >
      <Skeleton alto={40} ancho={40} radio={theme.radius.completo} />
      <View style={{ flex: 1, gap: theme.spacing.sm }}>
        <Skeleton alto={14} ancho="60%" />
        <Skeleton alto={12} ancho="35%" />
      </View>
      <Skeleton alto={16} ancho={72} />
    </View>
  );
}
