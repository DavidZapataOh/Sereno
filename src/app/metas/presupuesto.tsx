import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useState } from 'react';

import { copiarDelMesAnterior, monthlyBudget } from '@/application/budget/monthly-budget';
import { listCategories } from '@/application/categorization/ensure-default-categories';
import { slugOf } from '@/domain/categorization/taxonomy';
import { money } from '@/domain/money/money';
import { calendarDay } from '@/domain/time/colombia';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { ErrorState, LoadingState } from '@/ui/components/states';
import { MoneyField } from '@/ui/components/text-field';
import { EnvelopeRow } from '@/ui/budget/envelope-row';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_PRESUPUESTO = {
  titulo: 'Presupuesto',
  ingreso: 'Cuánto entra este mes',
  /**
   * Se avisa antes que nada: un presupuesto a medias hace que el «te queda» de
   * cada sobre mienta, y entonces la pantalla entera engaña.
   */
  sinRepartir: (cuanto: string) => `Te faltan ${cuanto} por asignar`,
  deMas: (cuanto: string) => `Asignaste ${cuanto} más de lo que entra`,
  completo: 'Todo asignado',
  copiar: 'Copiar el mes anterior',
  sobres: 'Tus sobres',
  noPresupuestado: 'Gastado sin sobre',
  error: 'No se pudo leer el presupuesto.',
};

/** ¿A qué le asigné mi plata este mes, y cuánto me queda en cada cosa? */
export default function PresupuestoRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const mes = calendarDay(deps.clock()).slice(0, 7);
  // El reparto se hace sobre lo que David espera que entre este mes. El ledger
  // sabe lo que **entró**, pero se reparte antes de que entre: por eso se
  // declara aquí y no se deriva.
  const [ingreso, setIngreso] = useState(0n);

  const categorias = useQuery({
    queryKey: ['categorias', CURRENT_OWNER],
    queryFn: () => listCategories(deps, CURRENT_OWNER),
  });

  const datos = useQuery({
    enabled: categorias.data !== undefined,
    queryKey: ['presupuesto', CURRENT_OWNER, mes, String(ingreso)],
    queryFn: () =>
      monthlyBudget(deps, {
        owner: CURRENT_OWNER,
        mes,
        // Una categoría es una cuenta `categoria:<slug>`: el slug se saca de ahí.
        categorias: (categorias.data ?? [])
          .filter((c) => c.kind === 'gasto')
          .map((c) => slugOf(c.id)),
        ingresoDelMes: money(ingreso, 'COP'),
      }),
  });

  const copiar = useMutation({
    mutationFn: () => copiarDelMesAnterior(deps, { owner: CURRENT_OWNER, mes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['presupuesto', CURRENT_OWNER, mes] });
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: TEXTO_PRESUPUESTO.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {datos.isPending && <LoadingState />}
        {datos.isError && (
          <ErrorState
            description={TEXTO_PRESUPUESTO.error}
            onRetry={() => {
              void datos.refetch();
            }}
          />
        )}

        {datos.data !== undefined && (
          <>
            <Card style={{ gap: theme.spacing.sm }}>
              <MoneyField
                label={TEXTO_PRESUPUESTO.ingreso}
                value={ingreso}
                onChange={(valor) => {
                  setIngreso(valor ?? 0n);
                }}
                testID="ingreso-del-mes"
              />
              <AppText level="cuerpo">
                {datos.data.reparto.completo
                  ? TEXTO_PRESUPUESTO.completo
                  : datos.data.reparto.sinAsignar.amount < 0n
                    ? TEXTO_PRESUPUESTO.deMas(pesos(-datos.data.reparto.sinAsignar.amount))
                    : TEXTO_PRESUPUESTO.sinRepartir(pesos(datos.data.reparto.sinAsignar.amount))}
              </AppText>
              <Button
                label={TEXTO_PRESUPUESTO.copiar}
                variant="secundario"
                onPress={() => {
                  copiar.mutate();
                }}
                loading={copiar.isPending}
              />
            </Card>

            {datos.data.sobres.length > 0 && (
              <View style={{ gap: theme.spacing.sm }}>
                <AppText level="subtitulo">{TEXTO_PRESUPUESTO.sobres}</AppText>
                <Card style={{ paddingVertical: 0 }}>
                  {datos.data.sobres.map((estado) => (
                    <EnvelopeRow
                      key={estado.envelope.categoria}
                      estado={estado}
                      historico={datos.data.historico.find(
                        (h) => h.categoria === estado.envelope.categoria,
                      )}
                    />
                  ))}
                </Card>
              </View>
            )}

            {datos.data.noPresupuestado.length > 0 && (
              <View style={{ gap: theme.spacing.sm }}>
                <AppText level="subtitulo">{TEXTO_PRESUPUESTO.noPresupuestado}</AppText>
                {datos.data.noPresupuestado.map((x) => (
                  <AppText key={x.categoria} level="apoyo" color="textSecondary">
                    {`${x.categoria}: ${pesos(x.gastado.amount)}`}
                  </AppText>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

function pesos(amount: bigint): string {
  return `$ ${amount.toLocaleString('es-CO')}`;
}
