import { Text, type TextProps } from 'react-native';

import type { Palette } from '@/ui/theme/palette';
import type { TypeLevel, TypeScaleKey } from '@/ui/theme/typography';
import { useTheme } from '@/ui/theme/use-theme';

export type TextColorKey = Extract<
  keyof Palette,
  | 'textPrimary'
  | 'textSecondary'
  | 'textMuted'
  | 'accent'
  | 'ingreso'
  | 'gasto'
  | 'deuda'
  | 'peligro'
>;

interface Props extends Omit<TextProps, 'style'> {
  level?: TypeScaleKey;
  color?: TextColorKey;
  align?: 'left' | 'center' | 'right';
}

/**
 * Texto de la aplicación.
 *
 * Las pantallas no usan `Text` directamente: eso reintroduce tamaños y colores
 * escritos a mano, que es lo que el sistema de tema existe para evitar. No
 * acepta `style` a propósito; lo poco que hace falta ajustar —alineación,
 * recorte— tiene su prop.
 */
export function AppText({ level = 'cuerpo', color = 'textPrimary', align, ...rest }: Props) {
  const theme = useTheme();
  const nivel: TypeLevel = theme.type[level];

  return (
    <Text
      allowFontScaling
      style={{
        fontSize: nivel.fontSize,
        lineHeight: nivel.lineHeight,
        fontFamily: nivel.fontFamily,
        letterSpacing: nivel.letterSpacing,
        color: theme.palette[color],
        textAlign: align,
      }}
      {...rest}
    />
  );
}
