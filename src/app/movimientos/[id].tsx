import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View, type ViewStyle } from 'react-native';

import { confirmTransfer, undoTransfer } from '@/application/ingest/resolve-transfer';
import { getMovement } from '@/application/movements/movements';
import { transactionId } from '@/domain/ledger/ids';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { observability } from '@/infrastructure/observability';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { MovementDetail } from '@/ui/movements/movement-detail';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Qué fue exactamente este cargo? */
export default function MovimientoRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const consulta = useQuery({
    queryKey: ['movement', CURRENT_OWNER, id],
    queryFn: () => getMovement(deps, { owner: CURRENT_OWNER, id: transactionId(id) }),
  });
  const resolver = useMutation({
    mutationFn: (accion: 'confirmar' | 'deshacer') => {
      const transferId = consulta.data?.transferencia?.id;
      if (transferId === undefined) return Promise.reject(new Error('Sin transferencia'));
      return accion === 'confirmar'
        ? confirmTransfer(deps, { owner: CURRENT_OWNER, transferId })
        : undoTransfer(deps, { owner: CURRENT_OWNER, transferId });
    },
    // Confirmar o deshacer cambia saldos, movimientos y resumen: se invalida todo.
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      observability.captureError(error, { operacion: 'resolver-transferencia' });
    },
  });
  const fondo: ViewStyle = { flex: 1, backgroundColor: theme.palette.background };

  if (consulta.isPending) {
    return (
      <View style={fondo}>
        <LoadingState />
      </View>
    );
  }
  if (consulta.isError) {
    return (
      <View style={fondo}>
        <ErrorState
          description="No se pudo leer el movimiento."
          onRetry={() => {
            void consulta.refetch();
          }}
        />
      </View>
    );
  }
  if (consulta.data === null) {
    return (
      <View style={fondo}>
        <EmptyState
          title="Este movimiento ya no existe"
          description="Puede que se haya fundido en una transferencia."
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Movimiento' }} />
      <MovementDetail
        detalle={consulta.data}
        busy={resolver.isPending}
        onConfirmTransfer={() => {
          resolver.mutate('confirmar');
        }}
        onUndoTransfer={() => {
          resolver.mutate('deshacer');
        }}
      />
    </>
  );
}
