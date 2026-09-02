import type { ReactNode } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { IconButton } from '@/ui/components/icon-button';
import { useReducedMotion } from '@/ui/motion/use-reduced-motion';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  onClose: () => void;
  /** Lo que anuncia el lector de pantalla al abrirse. */
  accessibilityLabel: string;
  children: ReactNode;
}

/** Cuánto hay que arrastrar para que se cierre. Menos que esto, vuelve. */
const UMBRAL_CIERRE = 120;

/**
 * Una hoja que sube desde abajo.
 *
 * **Se abre sobre lo que estabas mirando, y se arrastra para cerrar.** Es el
 * patrón de Uber y de Rappi, y no es estética: un toque menos, ninguna pérdida
 * de contexto, y el pulgar ya está donde tiene que estar para cerrarla.
 *
 * Sin librería nueva: `reanimated` y `gesture-handler` llevan trece sprints
 * instalados. Una hoja es una vista que se desplaza, un gesto que la sigue y un
 * fondo que se atenúa.
 *
 * **El arrastre no es la única salida**: el fondo cierra al tocarlo y hay botón
 * de cerrar. Un gesto que es la única forma de salir deja fuera a quien no
 * puede hacerlo.
 */
export function BottomSheet({ onClose, accessibilityLabel, children }: Props) {
  const theme = useTheme();
  const reducido = useReducedMotion();
  const alto = Dimensions.get('window').height;
  const desplazamiento = useSharedValue(reducido ? 0 : alto);

  // Entra desde abajo, salvo que se pida no mover nada.
  if (!reducido && desplazamiento.value === alto) {
    desplazamiento.value = withSpring(0, theme.motion.resorte.arrastre);
  }

  const arrastre = Gesture.Pan()
    .onChange((evento) => {
      // Solo hacia abajo: tirar hacia arriba de una hoja no significa nada.
      desplazamiento.value = Math.max(0, desplazamiento.value + evento.changeY);
    })
    .onEnd(() => {
      if (desplazamiento.value > UMBRAL_CIERRE) {
        desplazamiento.value = withTiming(alto, { duration: theme.motion.duracion.rapido });
        // El gesto corre en el hilo de la interfaz: cerrar es cosa de React.
        scheduleOnRN(onClose);
      } else {
        desplazamiento.value = withSpring(0, theme.motion.resorte.arrastre);
      }
    });

  const hoja = useAnimatedStyle(() => ({
    transform: [{ translateY: desplazamiento.value }],
  }));

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      {/*
        El fondo atenuado también cierra: es el gesto más fácil de descubrir
        con el dedo. **No cuenta como salida accesible**: la hoja es modal, así
        que el lector de pantalla no llega hasta aquí. Por eso dentro hay un
        botón de cerrar de verdad.
      */}
      <Pressable
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        accessibilityRole="button"
        accessibilityLabel="Cerrar tocando el fondo"
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          minHeight: theme.touchTargetMin,
          backgroundColor: theme.palette.textStrong,
          opacity: 0.35,
        }}
      />

      <GestureDetector gesture={arrastre}>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[
            {
              backgroundColor: theme.palette.surface,
              borderTopLeftRadius: theme.radius.enorme,
              borderTopRightRadius: theme.radius.enorme,
              padding: theme.spacing.lg,
              paddingBottom: theme.spacing.xxl,
              gap: theme.spacing.md,
              ...theme.shadow.flotante,
              shadowColor: theme.palette.textStrong,
            },
            hoja,
          ]}
        >
          {/* El asidero: la señal visual de que esto se arrastra. Apple lleva
              diez años enseñando este gesto con una raya de dos píxeles. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              alignSelf: 'center',
              width: theme.spacing.xxl,
              height: theme.spacing.xs,
              borderRadius: theme.radius.completo,
              backgroundColor: theme.palette.border,
            }}
          />

          {/*
            La salida de verdad. Arrastrar es cómodo y tocar el fondo es
            evidente, pero ninguna de las dos llega a quien navega con el
            lector: una hoja modal atrapa el foco dentro.
          */}
          <View style={{ alignItems: 'flex-end' }}>
            <IconButton icon="close" label="Cerrar" onPress={onClose} />
          </View>

          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
