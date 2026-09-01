import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { listFunds } from '@/application/sinking/manage-funds';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { FundRow } from '@/ui/sinking/fund-row';
import { useTheme } from '@/ui/theme/use-theme';

const TEXTO = {
  titulo: 'Fondos',
  explicacion:
    'Lo que llega una vez al año —el seguro, el impuesto, la matrícula— se aparta poco a poco cada mes. Apartar no es gastar: la plata sigue siendo tuya.',
  vacio: 'Todavía no tienes ningún fondo',
  vacioAyuda: 'Un fondo es para un gasto que sabes que va a llegar, pero no este mes.',
  error: 'No se pudieron leer los fondos.',
};

/** ¿Cuánto llevo apartado para lo que llega una vez al año? */
export default function FondosRoute() {
  const deps = useAppDeps();
  const theme = useTheme();

  const datos = useQuery({
    queryKey: ['fondos', CURRENT_OWNER],
    queryFn: () => listFunds(deps, CURRENT_OWNER),
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
        {datos.data?.length === 0 && (
          <EmptyState title={TEXTO.vacio} description={TEXTO.vacioAyuda} />
        )}
        {datos.data?.map((estado) => (
          <FundRow key={estado.fondo.accountId} estado={estado} />
        ))}
      </ScrollView>
    </>
  );
}
