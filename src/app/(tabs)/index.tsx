import { View } from 'react-native';

import { EmptyState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

/** Estado vacío honesto: dice qué habrá aquí y cuándo. Vale más que una pantalla en blanco. */
export default function HoyScreen() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.background }}>
      <EmptyState
        title="Aquí verás cuánto tienes"
        description="El patrimonio consolidado y lo que se paga pronto. Llega con la ingesta del sprint 04."
      />
    </View>
  );
}
