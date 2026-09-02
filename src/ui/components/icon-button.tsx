import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { PressableScale } from '@/ui/motion/pressable-scale';

import { useTheme } from '@/ui/theme/use-theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  icon: IconName;
  /** Obligatoria: un icono solo no dice nada al lector de pantalla. */
  label: string;
  onPress: () => void;
  testID?: string;
}

/** Botón de solo icono, para cabeceras. El icono va en el color del texto, sin acento. */
export function IconButton({ icon, label, onPress, testID }: Props) {
  const theme = useTheme();
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={theme.spacing.sm}
      style={{
        minWidth: theme.touchTargetMin,
        minHeight: theme.touchTargetMin,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.completo,
      }}
      pressedStyle={{ backgroundColor: theme.palette.surfacePressed }}
    >
      <MaterialCommunityIcons
        name={icon}
        size={theme.spacing.xl}
        color={theme.palette.textPrimary}
      />
    </PressableScale>
  );
}
