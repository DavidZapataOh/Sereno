import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { syncPortal } from '@/application/sync/sync-portal';
import type { Capture } from '@/domain/capture/reassembler';
import { getPortal } from '@/domain/portals/registry';
import { buildInjectedScript } from '@/infrastructure/capture/injected-script';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { observability } from '@/infrastructure/observability';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { PortalSession } from '@/ui/capture/portal-session';
import { ErrorState } from '@/ui/components/states';
import { useLastSyncStore } from '@/ui/sync/last-sync-store';
import { useTheme } from '@/ui/theme/use-theme';

export default function PortalRoute() {
  const theme = useTheme();
  const deps = useAppDeps();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const portal = getPortal(id);

  // La ruta es la capa de composición: aquí se junta la interfaz con la
  // infraestructura. Se genera una sola vez para no reinstalar el interceptor.
  const [script] = useState(() => buildInjectedScript(portal?.dominiosPermitidos ?? []));

  /**
   * Importar: ingerir, conciliar, detectar transferencias. Cambia saldos,
   * movimientos, resumen y conciliación a la vez, así que se invalida todo y
   * se aterriza en Movimientos con el resumen.
   */
  const importar = useMutation({
    mutationFn: (captures: Capture[]) => {
      if (portal === undefined) return Promise.reject(new Error('Portal desconocido'));
      return syncPortal(deps, { owner: CURRENT_OWNER, portalId: portal.id, captures });
    },
    onSuccess: (summary) => {
      useLastSyncStore.getState().set(summary);
      void queryClient.invalidateQueries();
      router.replace('/(tabs)/movimientos');
    },
    onError: (error) => {
      observability.captureError(error, { operacion: 'sync-portal' });
    },
  });

  if (portal === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.palette.background }}>
        <Stack.Screen options={{ title: 'Portal' }} />
        <ErrorState description={`No conocemos el portal «${id}».`} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: portal.nombre }} />
      <PortalSession
        portal={portal}
        injectedScript={script}
        onVerCapturas={() => {
          router.push('/ajustes/capturas');
        }}
        onImportar={(captures) => {
          importar.mutate(captures);
        }}
        importando={importar.isPending}
        errorImportacion={
          importar.isError ? 'No se pudo importar. Revisa Ajustes → Diagnóstico.' : undefined
        }
      />
    </>
  );
}
