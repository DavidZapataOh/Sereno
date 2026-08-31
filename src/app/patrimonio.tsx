import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { calendarDay } from '@/domain/time/colombia';
import { netWorthSeries } from '@/application/overview/record-snapshot';
import { getOverview } from '@/application/overview/get-overview';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { ErrorState, LoadingState } from '@/ui/components/states';
import { NetWorthChart } from '@/ui/overview/net-worth-chart';
import { useTheme } from '@/ui/theme/use-theme';

const TEXTO = {
  titulo: 'Patrimonio',
  hoy: 'Hoy',
  evolucion: 'Últimos 90 días',
  error: 'No se pudo leer la evolución.',
  comoSeMide:
    'Cada marca guarda el valor con las tasas de ese día. El pasado no se recalcula: si se recalculara, la línea cambiaría cada mañana y no mediría nada.',
};

/** ¿Estoy mejorando con el tiempo? */
export default function PatrimonioRoute() {
  const deps = useAppDeps();
  const theme = useTheme();

  const hoy = calendarDay(deps.clock());
  // Noventa días: suficiente para ver una tendencia sin que las barras se
  // vuelvan pelos de un píxel.
  const desde = calendarDay(
    new Date(Date.parse(`${hoy}T12:00:00Z`) - 90 * 86_400_000).toISOString(),
  );

  const datos = useQuery({
    queryKey: ['patrimonio', CURRENT_OWNER, hoy],
    queryFn: async () => ({
      serie: await netWorthSeries(deps, { owner: CURRENT_OWNER, desde, hasta: hoy }),
      overview: await getOverview(deps, CURRENT_OWNER),
    }),
  });

  return (
    <>
      <Stack.Screen options={{ title: TEXTO.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {datos.isPending && <LoadingState />}
        {datos.isError && (
          <ErrorState
            description={TEXTO.error}
            onRetry={() => {
              void datos.refetch();
            }}
          />
        )}

        {datos.data !== undefined && (
          <>
            <Card style={{ gap: theme.spacing.xs }}>
              <AppText level="apoyo" color="textSecondary">
                {TEXTO.hoy}
              </AppText>
              <Money
                amount={datos.data.overview.patrimonio.amount}
                currency={datos.data.overview.patrimonio.currency}
                direction="neutro"
                size="montoGrande"
              />
            </Card>

            <Card style={{ gap: theme.spacing.md }}>
              <AppText level="subtitulo">{TEXTO.evolucion}</AppText>
              <NetWorthChart serie={datos.data.serie} />
            </Card>

            <View>
              <AppText level="apoyo" color="textSecondary">
                {TEXTO.comoSeMide}
              </AppText>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
