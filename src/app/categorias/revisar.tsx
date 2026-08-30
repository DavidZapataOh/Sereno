import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, View, type ViewStyle } from 'react-native';

import { listCategories } from '@/application/categorization/ensure-default-categories';
import {
  categorizeGroup,
  lastBatch,
  listPending,
  undoBatch,
  type PendingGroup,
} from '@/application/categorization/review';
import type { AccountId } from '@/domain/ledger/ids';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { observability } from '@/infrastructure/observability';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { CategoryPicker } from '@/ui/categories/category-picker';
import { PendingGroupRow } from '@/ui/categories/pending-group-row';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Qué movimientos necesitan que yo diga en qué se fueron? */
export default function RevisarRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [grupo, setGrupo] = useState<PendingGroup | null>(null);

  const pendientes = useQuery({
    queryKey: ['pending', CURRENT_OWNER],
    queryFn: () => listPending(deps, { owner: CURRENT_OWNER }),
  });
  const categorias = useQuery({
    queryKey: ['categories', CURRENT_OWNER],
    queryFn: () => listCategories(deps, CURRENT_OWNER),
  });
  const ultimoLote = useQuery({
    queryKey: ['last-batch', CURRENT_OWNER],
    queryFn: () => lastBatch(deps, CURRENT_OWNER),
  });

  const clasificar = useMutation({
    mutationFn: (entrada: { grupo: PendingGroup; categoria: AccountId; siempre: boolean }) =>
      categorizeGroup(deps, {
        owner: CURRENT_OWNER,
        transactionIds: entrada.grupo.transacciones.map((t) => t.id),
        categoria: entrada.categoria,
        siempre: entrada.siempre,
      }),
    onSuccess: () => {
      setGrupo(null);
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      observability.captureError(error, { operacion: 'clasificar-grupo' });
    },
  });
  const deshacer = useMutation({
    mutationFn: (batchId: string) => undoBatch(deps, { owner: CURRENT_OWNER, batchId }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      observability.captureError(error, { operacion: 'deshacer-lote' });
    },
  });

  const porId = new Map((categorias.data ?? []).map((c) => [c.id, c]));
  const fondo: ViewStyle = { flex: 1, backgroundColor: theme.palette.background };

  const elegir = (categoria: AccountId): void => {
    if (grupo === null) return;
    const n = grupo.transacciones.length;
    const nombre = porId.get(categoria)?.nombre ?? 'esa categoría';
    Alert.alert(
      `${grupo.comercio.nombre} → ${nombre}`,
      '¿Solo estos movimientos, o siempre que sea este comercio?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Solo estos ${String(n)}`,
          onPress: () => {
            clasificar.mutate({ grupo, categoria, siempre: false });
          },
        },
        {
          text: `Siempre que sea ${grupo.comercio.nombre}`,
          onPress: () => {
            clasificar.mutate({ grupo, categoria, siempre: true });
          },
        },
      ],
    );
  };

  if (pendientes.isPending) {
    return (
      <View style={fondo}>
        <LoadingState />
      </View>
    );
  }
  if (pendientes.isError) {
    return (
      <View style={fondo}>
        <ErrorState
          description="No se pudo leer lo pendiente."
          onRetry={() => {
            void queryClient.invalidateQueries();
          }}
        />
      </View>
    );
  }

  const lote = ultimoLote.data ?? null;
  const cabecera =
    lote === null ? null : (
      <View style={{ padding: theme.spacing.lg }}>
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText>
            Clasificaste {String(lote.cambios.length)}{' '}
            {lote.cambios.length === 1 ? 'movimiento' : 'movimientos'} de {lote.comercio} como{' '}
            {porId.get(lote.cambios[0]?.despues ?? ('' as AccountId))?.nombre ?? 'una categoría'}
            {lote.reglaId === null ? '' : ', y de ahora en adelante también'}.
          </AppText>
          <Button
            label="Deshacer"
            variant="secundario"
            loading={deshacer.isPending}
            onPress={() => {
              deshacer.mutate(lote.id);
            }}
          />
        </Card>
      </View>
    );

  return (
    <>
      <Stack.Screen options={{ title: 'Revisar' }} />
      <FlatList
        style={fondo}
        data={pendientes.data}
        keyExtractor={(g) => g.comercio.clave}
        renderItem={({ item }) => (
          <PendingGroupRow
            group={item}
            categorias={porId}
            onPress={() => {
              setGrupo(item);
            }}
          />
        )}
        ListHeaderComponent={cabecera}
        ListEmptyComponent={
          <EmptyState
            title="Todo está clasificado"
            description="Cuando importes movimientos nuevos y Sereno no sepa en qué se fueron, aparecerán aquí."
          />
        }
        contentContainerStyle={pendientes.data.length === 0 ? { flex: 1 } : undefined}
      />
      <CategoryPicker
        visible={grupo !== null}
        title={grupo === null ? 'Elige una categoría' : `${grupo.comercio.nombre}: ¿qué es?`}
        categories={categorias.data ?? []}
        selected={grupo?.sugerida ?? null}
        onSelect={elegir}
        onClose={() => {
          setGrupo(null);
        }}
      />
    </>
  );
}
