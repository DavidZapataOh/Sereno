import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { compareStrategies } from '@/application/debt/compare-strategies';
import { debtOverview } from '@/application/debt/debt-overview';
import { money } from '@/domain/money/money';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { DestinationGrid } from '@/ui/overview/destination-grid';
import { ErrorState, LoadingState } from '@/ui/components/states';
import { DebtHeader } from '@/ui/debt/debt-header';
import { DebtRow } from '@/ui/debt/debt-row';
import { useTheme } from '@/ui/theme/use-theme';

const TEXTO = {
  error: 'No se pudieron leer tus deudas.',
  tus: 'Tus deudas',
  proxima: (nombre: string, dia: string) => `Lo próximo: ${nombre}, el ${dia}`,
};

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * ¿Cuánto debo y cuándo salgo?
 *
 * La pantalla **no calcula nada**: todo viene ya hecho. El orden responde
 * primero la pregunta que uno se hace al abrir —cuánto debo—, después cuándo
 * sale, y al final el detalle.
 */
export default function DeudasScreen() {
  const deps = useAppDeps();
  const theme = useTheme();

  const resumen = useQuery({
    queryKey: ['deudas', CURRENT_OWNER],
    queryFn: () => debtOverview(deps, { owner: CURRENT_OWNER }),
  });

  // La fecha de salida sale de la avalancha con un presupuesto supuesto; la
  // pantalla de Estrategia deja probar otros.
  const salida = useQuery({
    queryKey: ['deudas-salida', CURRENT_OWNER],
    queryFn: () =>
      compareStrategies(deps, { owner: CURRENT_OWNER, presupuesto: money(500_000, 'COP') }),
  });

  const fechaDeSalida =
    salida.data?.avalancha.estado === 'sale' ? legible(salida.data.avalancha.fechaDeSalida) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      {resumen.isPending && <LoadingState filas={4} />}
      {resumen.isError && (
        <ErrorState
          description={TEXTO.error}
          onRetry={() => {
            void resumen.refetch();
          }}
        />
      )}

      {resumen.data !== undefined && (
        <>
          <DebtHeader
            total={resumen.data.total}
            cambio={resumen.data.cambio}
            fechaDeSalida={fechaDeSalida}
          />

          {resumen.data.proxima !== null && (
            <AppText level="apoyo" color="textSecondary">
              {TEXTO.proxima(resumen.data.proxima.nombre, diaLegible(resumen.data.proxima.vence))}
            </AppText>
          )}

          {resumen.data.deudas.length > 0 && (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText level="subtitulo">{TEXTO.tus}</AppText>
              <Card style={{ padding: 0 }}>
                {resumen.data.deudas.map((d) => (
                  <DebtRow
                    key={d.accountId}
                    deuda={d}
                    onPress={() => {
                      router.push({ pathname: '/cuentas/[id]', params: { id: d.accountId } });
                    }}
                  />
                ))}
              </Card>
            </View>
          )}
        </>
      )}

      {/* Los destinos, en la misma rejilla que en Hoy: una app se siente de
          una sola mano cuando lo mismo se hace igual en todas partes. */}
      <DestinationGrid
        destinos={[
          {
            titulo: 'Estrategia',
            icono: 'stairs-down',
            onPress: () => {
              router.push('/deudas/estrategia');
            },
          },
          {
            titulo: 'Calendario',
            icono: 'calendar-month-outline',
            onPress: () => {
              router.push('/deudas/calendario');
            },
          },
        ]}
      />
    </ScrollView>
  );
}

function legible(mes: string): string {
  const [anio = '', m = '01'] = mes.split('-');
  return `${MESES[Number(m) - 1] ?? m} de ${anio}`;
}

function diaLegible(dia: string): string {
  const [, m = '01', d = '01'] = dia.split('-');
  return `${String(Number(d))} de ${MESES[Number(m) - 1] ?? m}`;
}
