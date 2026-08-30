import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { getPortal } from '@/domain/portals/registry';
import { buildInjectedScript } from '@/infrastructure/capture/injected-script';
import { PortalSession } from '@/ui/capture/portal-session';
import { ErrorState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

export default function PortalRoute() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const portal = getPortal(id);

  // La ruta es la capa de composición: aquí se junta la interfaz con la
  // infraestructura. Se genera una sola vez para no reinstalar el interceptor.
  const [script] = useState(() => buildInjectedScript(portal?.dominiosPermitidos ?? []));

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
      />
    </>
  );
}
