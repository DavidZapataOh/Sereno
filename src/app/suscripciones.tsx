import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { listSubscriptions } from '@/application/subscriptions/list-subscriptions';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { SubscriptionRow } from '@/ui/subscriptions/subscription-row';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Qué se me cobra solo cada mes? */
export default function SuscripcionesRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const hoy = deps.clock();

  const datos = useQuery({
    queryKey: ['subscriptions', CURRENT_OWNER],
    queryFn: () => listSubscriptions(deps, { owner: CURRENT_OWNER }),
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Suscripciones' }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {datos.isPending && <LoadingState />}
        {datos.isError && (
          <ErrorState
            description="No se pudieron calcular las suscripciones."
            onRetry={() => void datos.refetch()}
          />
        )}

        {datos.data !== undefined && datos.data.suscripciones.length === 0 && (
          <EmptyState
            title="Todavía no se ve ninguna"
            description="Una suscripción aparece sola cuando el mismo comercio cobra tres veces con un ritmo regular."
          />
        )}

        {datos.data !== undefined && datos.data.suscripciones.length > 0 && (
          <View style={{ gap: theme.spacing.lg }}>
            {/* Lo primero: el número que sorprende a cualquiera. */}
            <Card style={{ gap: theme.spacing.xs }}>
              <AppText level="apoyo" color="textSecondary">
                Se te va cada mes en suscripciones
              </AppText>
              <Money
                amount={datos.data.totalMensual.amount}
                currency={datos.data.totalMensual.currency}
                direction="neutro"
                size="montoGrande"
                testID="suscripciones-total"
              />
            </Card>

            {datos.data.suscripciones.map((sub) => (
              <SubscriptionRow key={sub.clave} sub={sub} hoy={hoy} />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}
