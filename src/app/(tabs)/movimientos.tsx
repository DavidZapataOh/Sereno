import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, View, type ViewStyle } from 'react-native';

import { listPending } from '@/application/categorization/review';
import { listMovements, type MovementView } from '@/application/movements/movements';
import { agruparPorDia } from '@/domain/movements/group-by-day';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { Card } from '@/ui/components/card';
import { NavRow } from '@/ui/components/nav-row';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { DaySection } from '@/ui/movements/day-section';
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
  const pendientes = useQuery({
    queryKey: ['pending', CURRENT_OWNER],
    queryFn: () => listPending(deps, { owner: CURRENT_OWNER }),
  });
  const porRevisar = pendientes.data?.reduce((n, g) => n + g.transacciones.length, 0) ?? 0;
  const fondo: ViewStyle = { flex: 1, backgroundColor: theme.palette.background };

  if (consulta.isPending) {
    return (
      <View style={fondo}>
        <LoadingState filas={8} />
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

  // La lista se aplana con las cabeceras dentro: una sola `FlatList` sigue
  // virtualizando —lo que exige el sprint 12— y las secciones no cuestan un
  // componente por día.
  type Fila =
    | { tipo: 'dia'; dia: string; titulo: string; gastado: bigint }
    | { tipo: 'movimiento'; movimiento: MovementView };
  const filas: Fila[] = agruparPorDia(items, deps.clock()).flatMap((grupo) => [
    { tipo: 'dia' as const, dia: grupo.dia, titulo: grupo.titulo, gastado: grupo.gastado },
    ...grupo.movimientos.map((movimiento) => ({ tipo: 'movimiento' as const, movimiento })),
  ]);

  return (
    <FlatList
      style={fondo}
      data={filas}
      keyExtractor={(fila) => (fila.tipo === 'dia' ? `dia-${fila.dia}` : fila.movimiento.id)}
      renderItem={({ item }) =>
        item.tipo === 'dia' ? (
          <DaySection titulo={item.titulo} total={item.gastado} />
        ) : (
          <MovementRow
            movement={item.movimiento}
            onPress={() => {
              router.push({ pathname: '/movimientos/[id]', params: { id: item.movimiento.id } });
            }}
          />
        )
      }
      onEndReached={() => {
        if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage();
      }}
      ListHeaderComponent={
        items.length === 0 ? null : (
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            {ultimaSync.summary !== null && (
              <SyncSummaryCard summary={ultimaSync.summary} onDismiss={ultimaSync.clear} />
            )}
            <Card style={{ padding: 0 }}>
              <NavRow
                title="Categorías"
                subtitle={
                  porRevisar > 0
                    ? `${String(porRevisar)} por revisar`
                    : 'Gasto del mes por categoría'
                }
                onPress={() => {
                  router.push('/categorias');
                }}
              />
            </Card>
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
