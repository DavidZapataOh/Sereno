import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { pullFromServer } from '@/application/sync/pull-from-server';
import { estadoDeIngesta } from '@/domain/sync/health';
import { PORTALS } from '@/domain/portals/registry';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { observability } from '@/infrastructure/observability';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { NavRow } from '@/ui/components/nav-row';
import { ServerSyncCard } from '@/ui/sync/server-sync-card';
import { useTheme } from '@/ui/theme/use-theme';

/**
 * Ajustes.
 *
 * Las conexiones viven aquí mismo, no en una pantalla aparte: con dos
 * portales, una pantalla intermedia es un toque que no aporta nada, y dejaría
 * la sesión del banco a cuatro toques del arranque.
 */
export default function AjustesScreen() {
  const theme = useTheme();
  const deps = useAppDeps();
  const queryClient = useQueryClient();

  // Lo que el servidor del sprint 06 ha traído. Sin servidor configurado,
  // `ultimaTraida` es null y la tarjeta lo dice.
  const estadoSync = useQuery({
    queryKey: ['sync-state', CURRENT_OWNER],
    queryFn: () => deps.sync.ultimaTraida(),
  });
  // La salud del servidor, si se puede preguntar. Sin servidor configurado o
  // sin conexión, la consulta falla y la tarjeta simplemente no la muestra.
  const salud = useQuery({
    queryKey: ['server-health', CURRENT_OWNER],
    queryFn: () => deps.servidor.salud(),
    staleTime: 60 * 1000,
    retry: false,
  });
  const traer = useMutation({
    mutationFn: () => pullFromServer(deps, { owner: CURRENT_OWNER }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      observability.captureError(error, { operacion: 'traer-del-servidor' });
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Ajustes' }} />
      <ScrollView
        style={{ backgroundColor: theme.palette.background }}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <AppText level="subtitulo">Conexiones</AppText>
          <Card style={{ padding: 0 }}>
            {PORTALS.map((portal) => (
              <NavRow
                key={portal.id}
                title={portal.nombre}
                subtitle="Iniciar sesión para leer movimientos"
                onPress={() => {
                  router.push({ pathname: '/ajustes/portal/[id]', params: { id: portal.id } });
                }}
              />
            ))}
          </Card>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText level="subtitulo">Servidor</AppText>
          <ServerSyncCard
            estado={{
              ultima: estadoSync.data ?? null,
              now: deps.clock(),
              pendiente: traer.isPending,
              error: traer.isError,
              ingesta:
                salud.data === undefined
                  ? undefined
                  : estadoDeIngesta(salud.data.ultimaCorrida, deps.clock(), {
                      iniciadoEn: salud.data.ultimaCorrida?.iniciadoEn,
                    }),
            }}
            onTraer={() => {
              traer.mutate();
            }}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText level="subtitulo">Herramientas</AppText>
          <Card style={{ padding: 0 }}>
            <NavRow
              title="Capturas"
              subtitle="Lo que Sereno leyó del banco en la última sesión"
              onPress={() => {
                router.push('/ajustes/capturas');
              }}
            />
            <NavRow
              title="Reglas"
              subtitle="Cómo se clasifican tus movimientos"
              onPress={() => {
                router.push('/ajustes/reglas');
              }}
            />
            <NavRow
              title="Tarjetas"
              subtitle="Cupo, día de corte y día de pago"
              onPress={() => {
                router.push('/ajustes/tarjetas');
              }}
            />
            <NavRow
              title="Wallets"
              subtitle="Direcciones que Sereno mira en la cadena"
              onPress={() => {
                router.push('/ajustes/wallets');
              }}
            />
            <NavRow
              title="Diagnóstico"
              subtitle="Salud de la contabilidad y muestra tipográfica"
              onPress={() => {
                router.push('/ajustes/diagnostico');
              }}
            />
          </Card>
        </View>
      </ScrollView>
    </>
  );
}
