import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { compareStrategies } from '@/application/debt/compare-strategies';
import { money } from '@/domain/money/money';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { ErrorState, LoadingState } from '@/ui/components/states';
import { MoneyField } from '@/ui/components/text-field';
import { PayoffCard, TEXTO_ESTRATEGIA } from '@/ui/debt/payoff-card';
import { useTheme } from '@/ui/theme/use-theme';

const TEXTO = {
  titulo: 'Estrategia',
  presupuesto: 'Cuánto puedes abonar al mes, entre todas',
  explicacion:
    'Las dos funcionan. La avalancha te ahorra plata; la bola de nieve cierra deudas antes, y eso ayuda a no rendirse. Elige tú.',
  error: 'No se pudo calcular.',
};

/** ¿Cuál es el camino más corto para salir y cuándo termino? */
export default function EstrategiaRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const [presupuesto, setPresupuesto] = useState(500_000n);

  const datos = useQuery({
    queryKey: ['estrategia', CURRENT_OWNER, String(presupuesto)],
    queryFn: () =>
      compareStrategies(deps, { owner: CURRENT_OWNER, presupuesto: money(presupuesto, 'COP') }),
  });

  return (
    <>
      <Stack.Screen options={{ title: TEXTO.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO.explicacion}
        </AppText>

        <Card>
          <MoneyField
            label={TEXTO.presupuesto}
            value={presupuesto}
            onChange={(valor) => {
              // Vaciar el campo no puede dejar el presupuesto en `null`: se
              // toma como cero, y entonces la simulación dice que no converge,
              // que es la verdad.
              setPresupuesto(valor ?? 0n);
            }}
            testID="presupuesto"
          />
        </Card>

        {datos.isPending && <LoadingState />}
        {datos.isError && (
          <ErrorState
            description={TEXTO.error}
            onRetry={() => {
              void datos.refetch();
            }}
          />
        )}

        {datos.data !== undefined && (
          <>
            <PayoffCard
              titulo={TEXTO_ESTRATEGIA.avalancha}
              como={TEXTO_ESTRATEGIA.avalanchaComo}
              resultado={datos.data.avalancha}
            />
            <PayoffCard
              titulo={TEXTO_ESTRATEGIA.bolaDeNieve}
              como={TEXTO_ESTRATEGIA.bolaComo}
              resultado={datos.data.bolaDeNieve}
            />

            {/* Los supuestos van debajo de la cifra, no escondidos: quien lee
                «sales en marzo» tiene derecho a saber de qué depende. */}
            <View style={{ gap: theme.spacing.xs }}>
              <AppText level="apoyo" color="textSecondary">
                {TEXTO_ESTRATEGIA.supuestos}
              </AppText>
              {datos.data.supuestos.map((s) => (
                <AppText key={s} level="micro" color="textMuted">
                  {`· ${s}`}
                </AppText>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
