import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { goalProgress } from '@/application/goals/goal-progress';
import { requiredIncome } from '@/application/income/required-income';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { DestinationGrid } from '@/ui/overview/destination-grid';
import { EmptyState, LoadingState } from '@/ui/components/states';
import { GoalRow, TEXTO_META } from '@/ui/goals/goal-row';
import { RequiredIncomeCard } from '@/ui/income/required-income-card';
import { useTheme } from '@/ui/theme/use-theme';

/**
 * ¿Voy a llegar?
 *
 * El resumen llega con los planes siguientes del sprint 10; los fondos ya
 * existen y se llega a ellos desde aquí. Una pantalla que dice «esto vendrá» y
 * esconde lo que ya funciona es peor que ninguna.
 */
export default function MetasScreen() {
  const deps = useAppDeps();
  const theme = useTheme();

  const metas = useQuery({
    queryKey: ['metas', CURRENT_OWNER],
    queryFn: () => goalProgress(deps, CURRENT_OWNER),
  });

  const ingreso = useQuery({
    queryKey: ['ingreso-requerido', CURRENT_OWNER],
    queryFn: () => requiredIncome(deps, { owner: CURRENT_OWNER }),
  });

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      {metas.isPending && <LoadingState filas={4} />}

      {/* Lo primero: cuánto hay que ganar. Es la pregunta que trae aquí. */}
      {ingreso.data !== undefined && <RequiredIncomeCard resumen={ingreso.data} />}

      {metas.data?.metas.length === 0 && (
        <EmptyState
          title="Aquí verás si vas a llegar"
          description="Tus metas de ahorro y cuánto tienes que apartar cada mes."
        />
      )}

      {metas.data?.metas.map((estado) => (
        <GoalRow key={estado.fondo.accountId} estado={estado} />
      ))}

      {metas.data?.cabeEnElIngreso === false && (
        <View>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_META.noCabe}
          </AppText>
        </View>
      )}
      <DestinationGrid
        destinos={[
          {
            titulo: 'Proyección',
            icono: 'chart-timeline-variant',
            onPress: () => {
              router.push('/metas/proyeccion');
            },
          },
          {
            titulo: 'Presupuesto',
            icono: 'wallet-outline',
            onPress: () => {
              router.push('/metas/presupuesto');
            },
          },
          {
            titulo: 'Fondos',
            icono: 'piggy-bank-outline',
            onPress: () => {
              router.push('/metas/fondos');
            },
          },
        ]}
      />
    </ScrollView>
  );
}
