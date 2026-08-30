import { View } from 'react-native';

import { EmptyState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

/** Estado vacío honesto: dice qué habrá aquí y cuándo. Vale más que una pantalla en blanco. */
export default function MetasScreen() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.background }}>
      <EmptyState
        title="Aquí verás si vas a llegar"
        description="Cuánto tienes que generar cada mes y cuánto apartar para tus objetivos."
      />
    </View>
  );
}
