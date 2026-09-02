import { useMutation } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { ask } from '@/application/assistant/ask';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { TEXTO_ASISTENTE } from '@/ui/assistant/answer-card';
import { AssistantPanel } from '@/ui/assistant/assistant-panel';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Me alcanza para el viaje si sigo así? */
export default function AsistenteRoute() {
  const deps = useAppDeps();
  const theme = useTheme();

  const consulta = useMutation({
    mutationFn: (texto: string) => ask(deps, { owner: CURRENT_OWNER, pregunta: texto }),
  });

  return (
    <>
      <Stack.Screen options={{ title: TEXTO_ASISTENTE.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <AssistantPanel
          onPreguntar={(pregunta) => {
            consulta.mutate(pregunta);
          }}
          pensando={consulta.isPending}
          resultado={consulta.data?.resultado}
          enviado={consulta.data?.enviado}
          fallo={consulta.isError}
        />
      </ScrollView>
    </>
  );
}
