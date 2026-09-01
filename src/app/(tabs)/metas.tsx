import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { Card } from '@/ui/components/card';
import { NavRow } from '@/ui/components/nav-row';
import { EmptyState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

/**
 * ¿Voy a llegar?
 *
 * El resumen llega con los planes siguientes del sprint 10; los fondos ya
 * existen y se llega a ellos desde aquí. Una pantalla que dice «esto vendrá» y
 * esconde lo que ya funciona es peor que ninguna.
 */
export default function MetasScreen() {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <EmptyState
        title="Aquí verás si vas a llegar"
        description="Tus metas de ahorro y cuánto tienes que apartar cada mes."
      />
      <Card style={{ padding: 0 }}>
        <NavRow
          title="Presupuesto"
          subtitle="A qué le asignaste tu plata este mes"
          onPress={() => {
            router.push('/metas/presupuesto');
          }}
        />
        <NavRow
          title="Fondos"
          subtitle="Para lo que llega una vez al año"
          onPress={() => {
            router.push('/metas/fondos');
          }}
        />
      </Card>
    </ScrollView>
  );
}
