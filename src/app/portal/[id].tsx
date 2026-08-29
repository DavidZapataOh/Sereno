import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getPortal } from '@/domain/portals/registry';
import { buildInjectedScript } from '@/infrastructure/capture/injected-script';
import { PortalSession } from '@/ui/capture/portal-session';

export default function PortalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const portal = getPortal(id);

  // La ruta es la capa de composición: aquí se junta la interfaz con la
  // infraestructura. Se genera una sola vez para no reinstalar el interceptor.
  const [script] = useState(() => buildInjectedScript(portal?.dominiosPermitidos ?? []));

  if (portal === undefined) {
    return (
      <View style={styles.center}>
        <Text>No conocemos el portal «{id}».</Text>
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
          router.push('/capturas');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
