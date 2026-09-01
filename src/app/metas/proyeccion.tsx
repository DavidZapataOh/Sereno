import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { cashFlow } from '@/application/cashflow/cash-flow';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { ErrorState, LoadingState } from '@/ui/components/states';
import { ProjectionChart, TEXTO_PROYECCION } from '@/ui/cashflow/projection-chart';
import { useTheme } from '@/ui/theme/use-theme';

const MESES = 6;

const TEXTO = {
  titulo: 'Proyección',
  explicacion:
    'El saldo de los próximos seis meses con lo que ya se sabe: cuotas, tarjetas, suscripciones y lo que apartas. Es una proyección, no una promesa.',
  supuestos: 'Esto vale si:',
  error: 'No se pudo calcular la proyección.',
};

/** ¿Voy a tener plata suficiente los próximos meses? */
export default function ProyeccionRoute() {
  const deps = useAppDeps();
  const theme = useTheme();

  const datos = useQuery({
    queryKey: ['proyeccion', CURRENT_OWNER],
    queryFn: () => cashFlow(deps, { owner: CURRENT_OWNER, meses: MESES }),
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

        {datos.data !== undefined && (
          <>
            <Card style={{ gap: theme.spacing.md }}>
              <ProjectionChart
                meses={datos.data.meses}
                primerMesEnRojo={datos.data.primerMesEnRojo}
              />
            </Card>

            {/* Los supuestos van debajo de la cifra, no escondidos. */}
            <View style={{ gap: theme.spacing.xs }}>
              <AppText level="apoyo" color="textSecondary">
                {TEXTO.supuestos}
              </AppText>
              {datos.data.supuestos.map((s) => (
                <AppText key={s} level="micro" color="textMuted">
                  {`· ${s}`}
                </AppText>
              ))}
              <AppText level="micro" color="textMuted">
                {`· ${TEXTO_PROYECCION.comprometido}`}
              </AppText>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
