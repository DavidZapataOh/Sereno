import { useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/ui/theme/use-theme';

import { useReducedMotion } from './use-reduced-motion';

/**
 * El pulsable **es** el elemento animado, y no lleva uno dentro.
 *
 * Con una vista animada por dentro, el rol y la etiqueta quedaban en un nodo y
 * los estilos en otro: `getByRole('button')` dejaba de ver el color y el alto,
 * y con ello se caían las pruebas que vigilan el área táctil desde el sprint
 * 02. Lo cazaron ellas.
 */
const PressableAnimado = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** El estilo cuando está pulsado: normalmente, una superficie más oscura. */
  pressedStyle?: StyleProp<ViewStyle>;
}

/**
 * Un pulsable que se hunde.
 *
 * Tres por ciento de escala, con muelle. Suena a nada y es la diferencia entre
 * tocar una imagen y presionar un botón: el cerebro espera que el mundo digital
 * se comporte como el físico, y cuando lo hace, se nota aunque no se sepa por
 * qué.
 *
 * El color también cambia —`colors.txt`: «un gris un poco más oscuro al pulsar
 * hace que sientas que estás presionando algo»—, y esa parte **no** se apaga
 * con «reducir movimiento»: un cambio de color no es movimiento, y sin él la
 * pulsación se quedaría sin ninguna respuesta.
 */
export function PressableScale({ children, style, pressedStyle, disabled, ...rest }: Props) {
  const theme = useTheme();
  const reducido = useReducedMotion();
  const [pulsado, setPulsado] = useState(false);

  const animado = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(
          pulsado && disabled !== true && !reducido ? theme.motion.escalaPresion : 1,
          theme.motion.resorte.presion,
        ),
      },
    ],
  }));

  return (
    <PressableAnimado
      disabled={disabled}
      onPressIn={() => {
        setPulsado(true);
      }}
      onPressOut={() => {
        setPulsado(false);
      }}
      style={[style, pulsado && disabled !== true ? pressedStyle : null, animado]}
      {...rest}
    >
      {children}
    </PressableAnimado>
  );
}
