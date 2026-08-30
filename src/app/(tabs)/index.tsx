import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, View, type ViewStyle } from 'react-native';

import { getOverview } from '@/application/overview/get-overview';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { Card } from '@/ui/components/card';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { AccountRow } from '@/ui/overview/account-row';
import { DriftCard } from '@/ui/overview/drift-card';
import { OverviewHeader } from '@/ui/overview/overview-header';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Cuánto tengo en total y qué se paga pronto? */
export default function HoyScreen() {
  const deps = useAppDeps();
  const theme = useTheme();
  const consulta = useQuery({
    queryKey: ['overview', CURRENT_OWNER],
    queryFn: () => getOverview(deps, CURRENT_OWNER),
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
        ultimaSincronizacion={o.ultimaSincronizacion?.terminadoEn ?? null}
        now={deps.clock()}
      />
      {o.conciliacion !== null && <DriftCard reconciliation={o.conciliacion} />}
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
    </ScrollView>
  );
}
