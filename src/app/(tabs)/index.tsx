import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, View, type ViewStyle } from 'react-native';

import { adjustToReconcile } from '@/application/ledger/adjust-to-reconcile';
import { getOverview } from '@/application/overview/get-overview';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { observability } from '@/infrastructure/observability';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { Card } from '@/ui/components/card';
import { NavRow } from '@/ui/components/nav-row';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { AccountRow } from '@/ui/overview/account-row';
import { DriftCard } from '@/ui/overview/drift-card';
import { OverviewHeader } from '@/ui/overview/overview-header';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Cuánto tengo en total y qué se paga pronto? */
export default function HoyScreen() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ['overview', CURRENT_OWNER],
    queryFn: () => getOverview(deps, CURRENT_OWNER),
  });
  // «Asumir la diferencia»: un ajuste con motivo que cierra la conciliación.
  const asumir = useMutation({
    mutationFn: (reconciliationId: string) =>
      adjustToReconcile(deps, { owner: CURRENT_OWNER, reconciliationId }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      observability.captureError(error, { operacion: 'asumir-diferencia' });
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
          description="No se pudo leer tu resumen."
          onRetry={() => {
            void consulta.refetch();
          }}
        />
      </View>
    );
  }
  const o = consulta.data;
  if (o.cuentas.length === 0) {
    return (
      <View style={fondo}>
        <EmptyState
          title="Todavía no hay nada que mostrar"
          description="Conecta Bancolombia desde Ajustes e importa tus movimientos."
          action={{
            label: 'Ir a Ajustes',
            onPress: () => {
              router.push('/ajustes');
            },
          }}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={fondo}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
    >
      <OverviewHeader
        patrimonio={o.patrimonio}
        sinValorar={o.sinValorar.map((c) => c.saldo)}
        tasaMasVieja={o.tasasUsadas.map((t) => t.momento).sort()[0] ?? null}
        ultimaSincronizacion={o.ultimaSincronizacion?.terminadoEn ?? null}
        now={deps.clock()}
      />
      {o.conciliacion !== null && (
        <DriftCard
          reconciliation={o.conciliacion}
          onAdjust={() => {
            if (o.conciliacion !== null) asumir.mutate(o.conciliacion.id);
          }}
        />
      )}
      <Card style={{ padding: 0 }}>
        {o.cuentas.map((c) => (
          <AccountRow
            key={c.account.id}
            account={c.account}
            saldo={c.saldo}
            onPress={() => {
              router.push({ pathname: '/cuentas/[id]', params: { id: c.account.id } });
            }}
          />
        ))}
      </Card>
      <Card style={{ padding: 0 }}>
        <NavRow
          title="Patrimonio"
          subtitle="Cómo se ha movido con el tiempo"
          onPress={() => {
            router.push('/patrimonio');
          }}
        />
        <NavRow
          title="Suscripciones"
          subtitle="Lo que se te cobra solo cada mes"
          onPress={() => {
            router.push('/suscripciones');
          }}
        />
      </Card>
    </ScrollView>
  );
}
