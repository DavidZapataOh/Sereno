import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from '@/ui/components/app-text';
import { PressableScale } from '@/ui/motion/pressable-scale';
import { useTheme } from '@/ui/theme/use-theme';

export interface Destino {
  titulo: string;
  icono: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
}

/**
 * Los destinos secundarios, en rejilla de dos.
 *
 * Eran seis filas iguales, apiladas, con el mismo peso que el patrimonio. Seis
 * decisiones seguidas es lo que produce que no se tome ninguna.
 *
 * En rejilla ocupan la mitad del alto, se recorren de un vistazo y **dejan de
 * competir con lo importante**: el icono va sin color propio —solo el estado
 * lleva color, dice `colors.txt`— y el texto baja a apoyo.
 */
export function DestinationGrid({ destinos }: { destinos: readonly Destino[] }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
      {destinos.map((destino) => (
        <PressableScale
          key={destino.titulo}
          accessibilityRole="button"
          accessibilityLabel={destino.titulo}
          onPress={destino.onPress}
          style={{
            flexGrow: 1,
            flexBasis: '46%',
            minHeight: theme.touchTargetMin + theme.spacing.xl,
            gap: theme.spacing.sm,
            padding: theme.spacing.lg,
            borderRadius: theme.radius.grande,
            backgroundColor: theme.palette.surface,
            borderWidth: 1,
            borderColor: theme.palette.border,
            justifyContent: 'center',
          }}
          pressedStyle={{ backgroundColor: theme.palette.surfacePressed }}
        >
          <MaterialCommunityIcons
            name={destino.icono}
            size={theme.spacing.xl}
            color={theme.palette.textSecondary}
          />
          <AppText level="apoyo">{destino.titulo}</AppText>
        </PressableScale>
      ))}
    </View>
  );
}
