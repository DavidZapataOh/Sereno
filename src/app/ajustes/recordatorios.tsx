import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { rescheduleReminders } from '@/application/alerts/reschedule-reminders';
import { MAXIMO_DIAS_ANTES } from '@/domain/alerts/reminder-settings';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { LoadingState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_RECORDATORIOS = {
  titulo: 'Recordatorios',
  explicacion:
    'Sereno te avisa antes de cada vencimiento. Los avisos se vuelven a programar cada vez que abres la app, porque Android los olvida al reiniciar el teléfono.',
  sinPermiso:
    'Android no ha dado permiso para avisarte. Sin él la app funciona igual, pero no te llegará ningún recordatorio.',
  pedirPermiso: 'Permitir avisos',
  silenciado: 'Los avisos están silenciados.',
  programados: (cuantos: number) =>
    cuantos === 1 ? '1 aviso programado' : `${String(cuantos)} avisos programados`,
  ninguno: 'No hay nada por vencer en los próximos dos meses.',
  antelacion: (dias: number) =>
    dias === 0
      ? 'Te avisa el mismo día'
      : dias === 1
        ? 'Te avisa un día antes'
        : `Te avisa ${String(dias)} días antes`,
  sinMontos: 'Los avisos no dicen cuánto debes: se leen en la pantalla de bloqueo.',
};

/** ¿Con cuánta antelación quiero que me avisen, y de qué? */
export default function RecordatoriosRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const estado = useQuery({
    queryKey: ['recordatorios', CURRENT_OWNER],
    queryFn: () => rescheduleReminders(deps, { owner: CURRENT_OWNER }),
    retry: false,
  });

  const reprogramar = useMutation({
    mutationFn: () => rescheduleReminders(deps, { owner: CURRENT_OWNER }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recordatorios', CURRENT_OWNER] });
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: TEXTO_RECORDATORIOS.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_RECORDATORIOS.explicacion}
        </AppText>

        {estado.isPending && <LoadingState />}

        {estado.data !== undefined && (
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText level="cuerpo">
              {estado.data.motivo === 'sin-permiso'
                ? TEXTO_RECORDATORIOS.sinPermiso
                : estado.data.motivo === 'silenciado'
                  ? TEXTO_RECORDATORIOS.silenciado
                  : estado.data.programados === 0
                    ? TEXTO_RECORDATORIOS.ninguno
                    : TEXTO_RECORDATORIOS.programados(estado.data.programados)}
            </AppText>

            <AppText level="apoyo" color="textSecondary">
              {TEXTO_RECORDATORIOS.antelacion(deps.ajustesDeAviso.diasAntes)}
            </AppText>

            {estado.data.motivo === 'sin-permiso' && (
              <Button
                label={TEXTO_RECORDATORIOS.pedirPermiso}
                onPress={() => {
                  reprogramar.mutate();
                }}
                loading={reprogramar.isPending}
              />
            )}
          </Card>
        )}

        <View>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_RECORDATORIOS.sinMontos}
          </AppText>
          <AppText level="micro" color="textMuted">
            {`Máximo ${String(MAXIMO_DIAS_ANTES)} días de antelación.`}
          </AppText>
        </View>
      </ScrollView>
    </>
  );
}
