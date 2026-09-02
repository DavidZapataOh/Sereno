import { View } from 'react-native';

/**
 * Reanimated, doblado a mano.
 *
 * El doble que trae la librería **no sirve aquí**: importa su propio `index`,
 * que arranca el runtime de *worklets*, que necesita el puente nativo y en Jest
 * revienta al importarse. Se comprobó antes de escribir esto.
 *
 * Este doble aplica las animaciones al instante: una prueba ve el estado final
 * sin esperar, que es lo que una prueba quiere. Lo que **no** comprueba es la
 * animación en sí —eso solo se ve en el teléfono—, y por eso ninguna prueba de
 * este proyecto afirma que algo «se animó»: afirman que responde, que llega al
 * valor correcto y que con «reducir movimiento» sigue funcionando.
 */
const identidad = <T,>(valor: T): T => valor;

module.exports = {
  __esModule: true,
  default: { View, Text: View, ScrollView: View, Image: View, createAnimatedComponent: identidad },
  useAnimatedStyle: (fabrica: () => unknown) => fabrica(),
  useSharedValue: (inicial: unknown) => ({ value: inicial }),
  useAnimatedProps: (fabrica: () => unknown) => fabrica(),
  // Lo usa `gesture-handler` por dentro para enganchar los gestos: sin esto,
  // cualquier componente con `GestureDetector` revienta al renderizarse.
  useEvent: () => () => undefined,
  useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
  useComposedEventHandler: () => () => undefined,
  setGestureState: () => undefined,
  isSharedValue: () => false,
  useDerivedValue: (fabrica: () => unknown) => ({ value: fabrica() }),
  withSpring: identidad,
  withTiming: identidad,
  withDelay: (_ms: number, valor: unknown) => valor,
  withSequence: (...valores: unknown[]) => valores.at(-1),
  withRepeat: identidad,
  runOnJS:
    <A extends unknown[]>(fn: (...args: A) => unknown) =>
    (...args: A) =>
      fn(...args),
  cancelAnimation: () => undefined,
  scheduleOnRN: <A extends unknown[]>(fn: (...args: A) => unknown, ...args: A) => fn(...args),
  interpolate: (valor: number) => valor,
  Extrapolation: { CLAMP: 'clamp' },
  Easing: {
    linear: identidad,
    ease: identidad,
    out: identidad,
    inOut: identidad,
    bezier: () => identidad,
  },
};
