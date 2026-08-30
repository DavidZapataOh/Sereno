import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View, type PressableStateCallbackType } from 'react-native';

import { useTheme } from '@/ui/theme/use-theme';

import { AppText } from './app-text';

interface Props {
  title: string;
  subtitle?: string;
  onPress: () => void;
  testID?: string;
}

/**
 * Fila que lleva a otra pantalla.
 *
 * El chevron va en gris: los iconos no llevan color, su trabajo es ser
 * reconocibles. El color se reserva para el estado.
 */
export function NavRow({ title, subtitle, onPress, testID }: Props) {
  const theme = useTheme();
  const etiqueta = subtitle === undefined ? title : `${title}. ${subtitle}`;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={({ pressed }: PressableStateCallbackType) => ({
        minHeight: theme.touchTargetMin,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: pressed ? theme.palette.surfacePressed : undefined,
      })}
    >
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1}>{title}</AppText>
        {subtitle !== undefined && (
          <AppText level="apoyo" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={theme.spacing.xl}
        color={theme.palette.textMuted}
      />
    </Pressable>
  );
}
