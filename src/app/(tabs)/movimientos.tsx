import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, View, type ViewStyle } from 'react-native';

import { listMovements } from '@/application/movements/movements';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { MovementRow } from '@/ui/movements/movement-row';
import { useLastSyncStore } from '@/ui/sync/last-sync-store';
import { SyncSummaryCard } from '@/ui/sync/sync-summary-card';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿En qué se me está yendo el dinero? */
export default function MovimientosScreen() {
  const deps = useAppDeps();
  const theme = useTheme();
  const ultimaSync = useLastSyncStore();
  const consulta = useInfiniteQuery({
    queryKey: ['movements', CURRENT_OWNER],
    queryFn: ({ pageParam }) => listMovements(deps, { owner: CURRENT_OWNER, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.nextCursor ?? undefined,
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
          description="No se pudieron leer tus movimientos."
          onRetry={() => {
            void consulta.refetch();
          }}
        />
      </View>
    );
  }
  const items = consulta.data.pages.flatMap((p) => p.items);

  return (
    <FlatList
      style={fondo}
      data={items}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => (
        <MovementRow
          movement={item}
          onPress={() => {
            router.push({ pathname: '/movimientos/[id]', params: { id: item.id } });
          }}
        />
      )}
      onEndReached={() => {
        if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage();
      }}
      ListHeaderComponent={
        ultimaSync.summary === null ? null : (
          <View style={{ padding: theme.spacing.lg }}>
            <SyncSummaryCard summary={ultimaSync.summary} onDismiss={ultimaSync.clear} />
          </View>
        )
      }
      ListEmptyComponent={
        <EmptyState
          title="Aquí verás en qué se te va el dinero"
          description="Importa una sesión de Bancolombia desde Ajustes y aparecerán aquí."
          action={{
            label: 'Ir a Ajustes',
            onPress: () => {
              router.push('/ajustes');
            },
          }}
        />
      }
      contentContainerStyle={items.length === 0 ? { flex: 1 } : undefined}
    />
  );
}
