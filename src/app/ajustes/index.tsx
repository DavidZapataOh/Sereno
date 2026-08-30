import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { PORTALS } from '@/domain/portals/registry';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { NavRow } from '@/ui/components/nav-row';
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
