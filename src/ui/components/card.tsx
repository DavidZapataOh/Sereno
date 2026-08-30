import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/ui/theme/use-theme';

/**
 * Contenedor de superficie.
 *
 * Se separa del fondo con un borde, no con sombra: es la capa de menos ruido
 * y en Android la sombra se pinta distinto según la versión. Acepta `style`
 * solo para disposición —márgenes, flex—; los colores vienen del tema.
 */
export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.palette.surface,
          borderRadius: theme.radius.grande,
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
