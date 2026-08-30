import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { ScrollView, View, type ViewStyle } from 'react-native';

import { listPending } from '@/application/categorization/review';
import { monthRange, spendingByCategory } from '@/application/categorization/spending';
import { add, zero } from '@/domain/money/money';
import { formatMonthYear } from '@/domain/time/format';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { CategoryRow } from '@/ui/categories/category-row';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Cómo se reparte mi gasto por categoría? */
export default function CategoriasRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const ahora = deps.clock();
  const mes = monthRange(ahora);
  const gasto = useQuery({
    queryKey: ['spending', CURRENT_OWNER, mes.desde],
    queryFn: () => spendingByCategory(deps, { owner: CURRENT_OWNER, kind: 'gasto', ...mes }),
  });
  const pendientes = useQuery({
    queryKey: ['pending', CURRENT_OWNER],
    queryFn: () => listPending(deps, { owner: CURRENT_OWNER }),
  });
  const fondo: ViewStyle = { flex: 1, backgroundColor: theme.palette.background };

  if (gasto.isPending) {
    return (
      <View style={fondo}>
        <LoadingState />
      </View>
    );
  }
  if (gasto.isError) {
    return (
      <View style={fondo}>
        <ErrorState
          description="No se pudo leer el gasto por categoría."
          onRetry={() => {
            void queryClient.invalidateQueries();
          }}
        />
      </View>
    );
  }

  const grupos = pendientes.data ?? [];
  const porRevisar = grupos.reduce((n, g) => n + g.transacciones.length, 0);
  const totalPendiente = grupos.reduce((t, g) => add(t, g.total), zero('COP'));
  const vacio = gasto.data.items.length === 0 && porRevisar === 0;

  return (
    <>
      <Stack.Screen options={{ title: 'Categorías' }} />
      {vacio ? (
        <View style={fondo}>
          <EmptyState
            title="Aquí verás en qué se va el dinero"
            description="Cuando importes movimientos, cada categoría mostrará cuánto se fue a ella este mes."
          />
        </View>
      ) : (
        <ScrollView
          style={fondo}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
        >
          <View style={{ gap: theme.spacing.xs }}>
            <AppText level="apoyo" color="textSecondary">
              Gasto de {formatMonthYear(ahora)}
            </AppText>
            <Money
              amount={gasto.data.total.amount}
              currency={gasto.data.total.currency}
              direction="sale"
              size="montoGrande"
            />
          </View>

          {porRevisar > 0 && (
            <Card style={{ gap: theme.spacing.sm }}>
              <AppText>
                {String(porRevisar)} {porRevisar === 1 ? 'movimiento' : 'movimientos'} por revisar
              </AppText>
              <AppText level="apoyo" color="textSecondary">
                Sereno no supo en qué se fueron. Decides una vez por comercio.
              </AppText>
              <Money
                amount={totalPendiente.amount}
                currency={totalPendiente.currency}
                direction="sale"
                size="montoPequeno"
              />
              <Button
                label="Revisar"
                onPress={() => {
                  router.push('/categorias/revisar');
                }}
              />
            </Card>
          )}

          {gasto.data.items.length > 0 && (
            <Card style={{ padding: 0 }}>
              {gasto.data.items.map((item) => (
                <CategoryRow
                  key={item.categoria.id}
                  spending={item}
                  onPress={() => {
                    // La categoría es una cuenta: su detalle ya lista sus movimientos.
                    router.push({ pathname: '/cuentas/[id]', params: { id: item.categoria.id } });
                  }}
                />
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </>
  );
}
