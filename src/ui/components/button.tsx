import { ActivityIndicator, Pressable, Text, type PressableStateCallbackType } from 'react-native';

import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  label: string;
  /**
   * Lo que anuncia el lector de pantalla, si el texto visible no basta.
   * «Limpiar» en un botón se entiende viendo la pantalla; oído suelto, no.
   */
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primario' | 'secundario' | 'peligro';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primario',
  disabled = false,
  loading = false,
  testID,
}: Props) {
  const theme = useTheme();
  const inactivo = disabled || loading;
  const { palette } = theme;

  // Tres estados en móvil: reposo, pulsado y deshabilitado. No hay hover.
  //  - Pulsado: un poco más oscuro, para que se sienta que se presiona algo.
  //  - Deshabilitado: desaturado, no transparente. La transparencia deja ver lo
  //    que hay detrás y rompe el contraste del texto.
  const colores = {
    primario: { fondo: palette.accent, pulsado: palette.accentPressed, texto: palette.onAccent },
    secundario: {
      fondo: palette.surfaceAlt,
      pulsado: palette.surfacePressed,
      texto: palette.textPrimary,
    },
    peligro: { fondo: palette.peligro, pulsado: palette.peligro, texto: palette.onPeligro },
  }[variant];

  const fondo = ({ pressed }: PressableStateCallbackType): string => {
    if (inactivo) return palette.surfaceAlt;
    return pressed ? colores.pulsado : colores.fondo;
  };
  const colorTexto = inactivo ? palette.textMuted : colores.texto;

  return (
    <Pressable
      testID={testID}
      onPress={inactivo ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactivo, busy: loading }}
      disabled={inactivo}
      style={(estado) => ({
        // El área táctil se garantiza aquí, aunque el contenido sea más bajo.
        minHeight: theme.touchTargetMin,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.medio,
        backgroundColor: fondo(estado),
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {loading ? (
        <ActivityIndicator color={colorTexto} accessibilityLabel="Cargando" />
      ) : (
        // El color va explícito y no por `AppText`: los tokens `on*` se pintan
        // encima de un relleno, no sobre el fondo de la app, y su contraste
        // está auditado en `palette.test.ts`.
        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.6}
          style={{
            fontSize: theme.type.cuerpo.fontSize,
            lineHeight: theme.type.cuerpo.lineHeight,
            fontFamily: theme.type.subtitulo.fontFamily,
            color: colorTexto,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
