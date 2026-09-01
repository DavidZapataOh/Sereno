import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { behaviorMetrics } from '@/application/metrics/behavior-metrics';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { MetricRow, TEXTO_METRICAS } from '@/ui/metrics/metric-row';
import { useTheme } from '@/ui/theme/use-theme';

const TEXTO = {
  titulo: 'Medidas',
  vacio: 'Todavía no hay historia suficiente',
  vacioAyuda: 'Estas medidas necesitan un par de meses de movimientos para significar algo.',
  error: 'No se pudieron calcular las medidas.',
};

/** ¿Estoy mejorando, o solo gastando distinto? */
export default function MetricasRoute() {
  const deps = useAppDeps();
  const theme = useTheme();

  const datos = useQuery({
    queryKey: ['metricas', CURRENT_OWNER],
    queryFn: () => behaviorMetrics(deps, { owner: CURRENT_OWNER }),
  });

  return (
    <>
      <Stack.Screen options={{ title: TEXTO.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_METRICAS.explicacion}
        </AppText>

        {datos.isPending && <LoadingState />}
        {datos.isError && (
          <ErrorState
            description={TEXTO.error}
            onRetry={() => {
              void datos.refetch();
            }}
          />
        )}

        {datos.data?.metricas.length === 0 && (
          <EmptyState title={TEXTO.vacio} description={TEXTO.vacioAyuda} />
        )}

        {datos.data?.metricas.map((m) => (
          <MetricRow key={m.clave} metrica={m} />
        ))}

        {/* Las que no se pudieron calcular se declaran: no salen como cero. */}
        {datos.data !== undefined &&
          datos.data.sinDatos.length > 0 &&
          datos.data.metricas.length > 0 && (
            <View>
              <AppText level="micro" color="textMuted">
                {TEXTO_METRICAS.sinDatos(datos.data.sinDatos.length)}
              </AppText>
            </View>
          )}
      </ScrollView>
    </>
  );
}
