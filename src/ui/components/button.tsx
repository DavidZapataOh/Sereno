import { ActivityIndicator, Text } from 'react-native';

import { useHaptics } from '@/ui/motion/haptics';
import { PressableScale } from '@/ui/motion/pressable-scale';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  label: string;
  /**
   * Lo que anuncia el lector de pantalla, si el texto visible no basta.
   * «Limpiar» en un botón se entiende viendo la pantalla; oído suelto, no.
   */
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primario' | 'acento' | 'secundario' | 'peligro';
  /**
   * Si al pulsarlo se siente.
   *
   * Solo donde algo cambió de verdad: guardar, confirmar, importar. Navegar no
   * vibra —si vibra todo, no significa nada—.
   */
  vibra?: boolean;
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
  vibra = false,
  testID,
}: Props) {
  const theme = useTheme();
  const { sentir } = useHaptics();
  const inactivo = disabled || loading;
  const { palette } = theme;

  // Tres estados en móvil: reposo, pulsado y deshabilitado. No hay hover.
  //  - Pulsado: un poco más oscuro, para que se sienta que se presiona algo.
  //  - Deshabilitado: desaturado, no transparente. La transparencia deja ver lo
  //    que hay detrás y rompe el contraste del texto.
  //
  // El primario es **neutro de máximo contraste**, no del color de marca: es lo
  // que hace que se vea desde el otro lado de la pantalla, y lo que libera al
  // ámbar para ser acento de verdad en vez de «el color de los botones».
  const colores = {
    primario: {
      fondo: palette.actionFill,
      pulsado: palette.actionFillPressed,
      texto: palette.onActionFill,
    },
    acento: {
      fondo: palette.accentFill,
      pulsado: palette.accentFillPressed,
      texto: palette.onAccentFill,
    },
    secundario: {
      fondo: palette.surfaceAlt,
      pulsado: palette.surfacePressed,
      texto: palette.textPrimary,
    },
    peligro: { fondo: palette.peligro, pulsado: palette.peligro, texto: palette.onPeligro },
  }[variant];

  const colorTexto = inactivo ? palette.textMuted : colores.texto;

  return (
    <PressableScale
      testID={testID}
      onPress={
        inactivo
          ? undefined
          : () => {
              if (vibra) sentir('confirmar');
              onPress();
            }
      }
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactivo, busy: loading }}
      disabled={inactivo}
      style={{
        // El área táctil se garantiza aquí, aunque el contenido sea más bajo.
        minHeight: theme.touchTargetMin,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.grande,
        backgroundColor: inactivo ? palette.surfaceAlt : colores.fondo,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pressedStyle={{ backgroundColor: colores.pulsado }}
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
    </PressableScale>
  );
}
