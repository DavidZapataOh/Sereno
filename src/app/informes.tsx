import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { porCategoria, porMes } from '@/application/reports/spending-report';
import { calendarDay } from '@/domain/time/colombia';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { Card } from '@/ui/components/card';
import { ErrorState, LoadingState } from '@/ui/components/states';
import { CategoryBars } from '@/ui/reports/category-bars';
import { MonthlyBars } from '@/ui/reports/monthly-bars';
import { useTheme } from '@/ui/theme/use-theme';

const MESES_DE_EVOLUCION = 6;

const TEXTO = { titulo: 'Informes', error: 'No se pudo armar el informe.' };

/** ¿En qué se me va la plata, y gasto más que antes? */
export default function InformesRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const mes = calendarDay(deps.clock()).slice(0, 7);
  const [elegida, setElegida] = useState<string | null>(null);

  const categorias = useQuery({
    queryKey: ['informe-categorias', CURRENT_OWNER, mes],
    queryFn: () => porCategoria(deps, { owner: CURRENT_OWNER, mes }),
  });

  const evolucion = useQuery({
    enabled: elegida !== null,
    queryKey: ['informe-evolucion', CURRENT_OWNER, elegida, mes],
    queryFn: () =>
      porMes(deps, {
        owner: CURRENT_OWNER,
        categoria: elegida ?? '',
        meses: MESES_DE_EVOLUCION,
        hasta: mes,
      }),
  });

  return (
    <>
      <Stack.Screen options={{ title: TEXTO.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {categorias.isPending && <LoadingState />}
        {categorias.isError && (
          <ErrorState
            description={TEXTO.error}
            onRetry={() => {
              void categorias.refetch();
            }}
          />
        )}

        {categorias.data !== undefined && (
          <Card style={{ gap: theme.spacing.md }}>
            {categorias.data.map((fila) => (
              <Pressable
                key={fila.categoria}
                accessibilityRole="button"
                accessibilityLabel={`Ver la evolución de ${fila.categoria}`}
                // La fila se ve alta porque lleva barra y monto, pero eso es
                // casualidad del contenido: declarada, la zona que responde al
                // dedo no depende de cuánto texto tenga la categoría.
                style={{ minHeight: theme.touchTargetMin, justifyContent: 'center' }}
                onPress={() => {
                  setElegida(fila.categoria);
                }}
              >
                <CategoryBars filas={[fila]} />
              </Pressable>
            ))}
          </Card>
        )}

        {elegida !== null && evolucion.data !== undefined && (
          <Card style={{ gap: theme.spacing.md }}>
            <MonthlyBars categoria={elegida} meses={evolucion.data} />
          </Card>
        )}
      </ScrollView>
    </>
  );
}
