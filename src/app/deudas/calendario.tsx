import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { paymentCalendar } from '@/application/calendar/payment-calendar';
import { calendarDay } from '@/domain/time/colombia';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { ObligationRow } from '@/ui/calendar/obligation-row';
import { useTheme } from '@/ui/theme/use-theme';

const TEXTO = {
  titulo: 'Calendario',
  vacio: 'No hay nada por pagar en los próximos dos meses',
  vacioAyuda:
    'Aparecen los pagos de tarjeta, las suscripciones detectadas y las cuotas de tus deudas. Lo que ya pagaste no vuelve a salir.',
  error: 'No se pudo armar el calendario.',
  pendientes: 'Por pagar',
  resueltas: 'Ya pagado',
};

/** ¿Qué tengo que pagar este mes y cuándo? */
export default function CalendarioRoute() {
  const deps = useAppDeps();
  const theme = useTheme();

  const hoy = calendarDay(deps.clock());

  const datos = useQuery({
    queryKey: ['calendario', CURRENT_OWNER, hoy],
    queryFn: () =>
      paymentCalendar(deps, { owner: CURRENT_OWNER, desde: hoy, hasta: enDosMeses(hoy) }),
  });

  const pendientes = datos.data?.filter((o) => o.estado !== 'pagada') ?? [];
  const pagadas = datos.data?.filter((o) => o.estado === 'pagada') ?? [];

  return (
    <>
      <Stack.Screen options={{ title: TEXTO.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {datos.isPending && <LoadingState />}
        {datos.isError && (
          <ErrorState
            description={TEXTO.error}
            onRetry={() => {
              void datos.refetch();
            }}
          />
        )}
        {datos.data?.length === 0 && (
          <EmptyState title={TEXTO.vacio} description={TEXTO.vacioAyuda} />
        )}

        {pendientes.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText level="subtitulo">{TEXTO.pendientes}</AppText>
            <Card style={{ paddingVertical: 0 }}>
              {pendientes.map((o) => (
                <ObligationRow key={o.id} obligacion={o} />
              ))}
            </Card>
          </View>
        )}

        {pagadas.length > 0 && (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText level="subtitulo">{TEXTO.resueltas}</AppText>
            <Card style={{ paddingVertical: 0 }}>
              {pagadas.map((o) => (
                <ObligationRow key={o.id} obligacion={o} />
              ))}
            </Card>
          </View>
        )}
      </ScrollView>
    </>
  );
}

/** El mismo día, dos meses después. */
function enDosMeses(dia: string): string {
  const [anio = 1970, mes = 1, d = 1] = dia.split('-').map(Number);
  const total = (anio - 1) * 12 + (mes - 1) + 2;
  return `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
