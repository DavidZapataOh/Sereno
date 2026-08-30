import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { ScrollView, View, type ViewStyle } from 'react-native';

import { getOverview } from '@/application/overview/get-overview';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { Card } from '@/ui/components/card';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { AccountRow } from '@/ui/overview/account-row';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Cómo se reparte lo que tengo entre mis cuentas? */
export default function CuentasScreen() {
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
          description="No se pudieron leer tus cuentas."
          onRetry={() => {
            void consulta.refetch();
          }}
        />
      </View>
    );
  }
  if (consulta.data.cuentas.length === 0) {
    return (
      <View style={fondo}>
        <EmptyState title="Sin cuentas todavía" description="Conecta una desde Ajustes." />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Cuentas' }} />
      <ScrollView style={fondo} contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Card style={{ padding: 0 }}>
          {consulta.data.cuentas.map((c) => (
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
    </>
  );
}
