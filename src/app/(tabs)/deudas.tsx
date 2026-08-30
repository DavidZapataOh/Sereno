import { View } from 'react-native';

import { EmptyState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

/** Estado vacío honesto: dice qué habrá aquí y cuándo. Vale más que una pantalla en blanco. */
export default function DeudasScreen() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.background }}>
      <EmptyState
        title="Aquí verás cuánto debes"
        description="Tarjetas, cuotas y la fecha en la que sales de deudas."
      />
    </View>
  );
}
