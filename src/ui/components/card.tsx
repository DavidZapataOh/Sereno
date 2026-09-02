import { View, type ViewProps } from 'react-native';

import { PressableScale } from '@/ui/motion/pressable-scale';
import { useTheme } from '@/ui/theme/use-theme';

/**
 * Contenedor de superficie.
 *
 * **Se separa del fondo porque el fondo es más oscuro que ella**, no por la
 * sombra: desde el sprint 14 el fondo es gris con matiz y la superficie es
 * blanca, así que una tarjeta ya existe sin ayuda. El borde se queda como
 * remate fino, y la sombra sigue reservada para lo que de verdad flota.
 *
 * Acepta `style` solo para disposición —márgenes, flex—; los colores vienen
 * del tema.
 */
export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.palette.surface,
          borderRadius: theme.radius.enorme,
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor: theme.palette.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

interface PressableCardProps extends ViewProps {
  onPress: () => void;
  accessibilityLabel: string;
}

/**
 * La misma tarjeta, cuando entera es un destino.
 *
 * Existe para no repetir el patrón de envolver una `Card` en un pulsable, que
 * es como se acaba con la mitad de las tarjetas hundiéndose al tocarlas y la
 * otra mitad no.
 */
export function PressableCard({
  onPress,
  accessibilityLabel,
  style,
  children,
}: PressableCardProps) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          minHeight: theme.touchTargetMin,
          backgroundColor: theme.palette.surface,
          borderRadius: theme.radius.enorme,
          padding: theme.spacing.lg,
          borderWidth: 1,
          borderColor: theme.palette.border,
        },
        style,
      ]}
      pressedStyle={{ backgroundColor: theme.palette.surfacePressed }}
    >
      {children}
    </PressableScale>
  );
}
