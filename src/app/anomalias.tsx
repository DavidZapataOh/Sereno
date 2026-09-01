import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { detectAnomalies } from '@/application/anomalies/detect-anomalies';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { AnomalyCard } from '@/ui/anomalies/anomaly-card';
import { useTheme } from '@/ui/theme/use-theme';

const TEXTO = {
  titulo: 'Avisos',
  explicacion:
    'Cobros de los últimos treinta días que no encajan con tu patrón. Lo que se repite cada mes por el mismo monto no aparece aquí.',
  vacio: 'Nada raro por ahora',
  vacioAyuda: 'Sereno mira los cobros recientes y compara con lo que sueles gastar.',
  error: 'No se pudieron revisar los cobros.',
};

/** ¿Hay algún cobro que se salga de lo normal? */
export default function AnomaliasRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const datos = useQuery({
    queryKey: ['anomalias', CURRENT_OWNER],
    queryFn: () => detectAnomalies(deps, { owner: CURRENT_OWNER }),
  });

  const descartar = useMutation({
    mutationFn: (id: string) => deps.anomalias.descartar(CURRENT_OWNER, id, deps.clock()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['anomalias', CURRENT_OWNER] });
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: TEXTO.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO.explicacion}
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

        {/* Que no haya nada raro es una buena noticia, y se dice así. */}
        {datos.data?.length === 0 && (
          <EmptyState title={TEXTO.vacio} description={TEXTO.vacioAyuda} />
        )}

        {datos.data?.map((a) => (
          <AnomalyCard
            key={a.id}
            anomalia={a}
            onDescartar={() => {
              descartar.mutate(a.id);
            }}
          />
        ))}
      </ScrollView>
    </>
  );
}
