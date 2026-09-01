import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { Card } from '@/ui/components/card';
import { NavRow } from '@/ui/components/nav-row';
import { EmptyState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

/**
 * ¿Cuánto debo y cuándo salgo?
 *
 * De momento el resumen sigue vacío —llega en el plan 05— pero el calendario ya
 * existe y se llega a él desde aquí: una pantalla que dice «esto vendrá» y
 * esconde lo que ya funciona es peor que ninguna.
 */
export default function DeudasScreen() {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <EmptyState
        title="Aquí verás cuánto debes"
        description="Tarjetas, cuotas y la fecha en la que sales de deudas."
      />
      <Card style={{ padding: 0 }}>
        <NavRow
          title="Estrategia"
          subtitle="Cuál es el camino más corto para salir"
          onPress={() => {
            router.push('/deudas/estrategia');
          }}
        />
        <NavRow
          title="Calendario"
          subtitle="Qué tienes que pagar y cuándo"
          onPress={() => {
            router.push('/deudas/calendario');
          }}
        />
      </Card>
    </ScrollView>
  );
}
