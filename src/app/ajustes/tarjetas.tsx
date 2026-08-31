import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';

import { configureCard, listCardConfigs } from '@/application/cards/configure-card';
import { reconcileCardDebt } from '@/application/cards/reconcile-card-debt';
import type { AccountId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { observability } from '@/infrastructure/observability';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { CardConfigForm } from '@/ui/cards/card-config-form';
import { AppText } from '@/ui/components/app-text';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Cuánto cupo tiene cada tarjeta y cuándo corta y se paga? */
export default function TarjetasRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const tarjetas = useQuery({
    queryKey: ['card-configs', CURRENT_OWNER],
    queryFn: () => listCardConfigs(deps, CURRENT_OWNER),
  });

  const guardar = useMutation({
    mutationFn: async (entrada: {
      accountId: AccountId;
      cupo: bigint;
      deuda: bigint;
      diaDeCorte: number;
      diaDePago: number;
    }) => {
      await configureCard(deps, {
        owner: CURRENT_OWNER,
        accountId: entrada.accountId,
        cupo: money(entrada.cupo, 'COP'),
        diaDeCorte: entrada.diaDeCorte,
        diaDePago: entrada.diaDePago,
      });
      // Después de configurar: si la deuda declarada no coincide con la del
      // ledger, se asienta el ajuste. Sin esto la tarjeta arranca en cero y
      // enseña el cupo entero disponible.
      await reconcileCardDebt(deps, {
        owner: CURRENT_OWNER,
        accountId: entrada.accountId,
        deuda: money(entrada.deuda, 'COP'),
      });
    },
    onSuccess: () => {
      // La deuda toca saldos y movimientos: se refresca todo lo que dependa
      // del ledger, no solo lo de tarjetas.
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      observability.captureError(error, { operacion: 'configurar-tarjeta' });
      // El motivo importa: casi siempre es un día imposible o una moneda que
      // no coincide, y sin decirlo el botón parece que no hace nada.
      Alert.alert('No se pudo guardar', error.message);
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Tarjetas' }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {tarjetas.isPending && <LoadingState />}
        {tarjetas.isError && (
          <ErrorState
            description="No se pudieron leer las tarjetas."
            onRetry={() => void tarjetas.refetch()}
          />
        )}
        {tarjetas.data?.length === 0 && (
          <EmptyState
            title="Todavía no hay tarjetas"
            description="Una tarjeta aparece aquí cuando llega su primer movimiento por correo."
          />
        )}
        {tarjetas.data !== undefined && tarjetas.data.length > 0 && (
          <View style={{ gap: theme.spacing.lg }}>
            <AppText level="apoyo" color="textSecondary">
              El cupo, el corte y el pago no llegan en ningún correo. Se ponen una vez.
            </AppText>
            {tarjetas.data.map((config) => (
              <CardConfigForm
                key={config.cuenta.id}
                config={config}
                deudaActual={config.deuda.amount}
                guardando={guardar.isPending}
                onGuardar={(datos) => {
                  guardar.mutate({ accountId: config.cuenta.id, ...datos });
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}
