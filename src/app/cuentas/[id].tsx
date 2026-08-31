import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Modal, View, type ViewStyle } from 'react-native';

import { cardSummary } from '@/application/cards/card-summary';
import { cycleStatement } from '@/application/cards/cycle-statement';
import { verifyCycle } from '@/application/cards/verify-cycle';
import { countCash } from '@/application/ledger/count-cash';
import { registerCashExpense } from '@/application/ledger/register-cash-expense';
import { listMovements } from '@/application/movements/movements';
import { accountId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { money } from '@/domain/money/money';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { CardSummaryCard } from '@/ui/cards/card-summary-card';
import { CycleCard } from '@/ui/cards/cycle-card';
import { CashCountForm } from '@/ui/movements/cash-count-form';
import { CashExpenseForm } from '@/ui/movements/cash-expense-form';
import { MovementRow } from '@/ui/movements/movement-row';
import { DriftCard } from '@/ui/overview/drift-card';
import { useTheme } from '@/ui/theme/use-theme';

/** ¿Qué ha pasado en esta cuenta? */
export default function CuentaRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cuentaId = accountId(id);
  const esEfectivo = cuentaId === systemAccountId('efectivo');
  const [registrando, setRegistrando] = useState(false);
  const [contando, setContando] = useState(false);

  const cuenta = useQuery({
    queryKey: ['account', CURRENT_OWNER, id],
    queryFn: () => deps.accounts.findById(cuentaId),
  });
  const saldo = useQuery({
    queryKey: ['balance', CURRENT_OWNER, id],
    queryFn: () => deps.accounts.balanceOf(cuentaId),
  });
  // Solo devuelve algo si la cuenta es una tarjeta configurada; en cualquier
  // otra cuenta es `null` y la tarjeta no se pinta.
  const tarjeta = useQuery({
    queryKey: ['card-summary', CURRENT_OWNER, id],
    queryFn: () => cardSummary(deps, { owner: CURRENT_OWNER, accountId: cuentaId }),
  });
  // Depende de lo mismo que la tarjeta: si la cuenta no es una tarjeta
  // configurada, `cycleStatement` devuelve null y no se pinta nada.
  const ciclo = useQuery({
    queryKey: ['card-cycle', CURRENT_OWNER, id],
    queryFn: async () => {
      const extracto = await cycleStatement(deps, {
        owner: CURRENT_OWNER,
        accountId: cuentaId,
        fecha: deps.clock(),
      });
      return extracto === null ? null : verifyCycle(extracto, deps.clock());
    },
  });
  const conciliacion = useQuery({
    queryKey: ['reconciliation', id],
    queryFn: () => deps.reconciliations.findLatest(cuentaId),
  });
  const movimientos = useQuery({
    queryKey: ['movements', CURRENT_OWNER, id],
    queryFn: () => listMovements(deps, { owner: CURRENT_OWNER, accountId: cuentaId, limit: 100 }),
  });

  const registrar = useMutation({
    mutationFn: (entrada: { amount: bigint; descripcion: string }) =>
      registerCashExpense(deps, {
        owner: CURRENT_OWNER,
        amount: money(entrada.amount, 'COP'),
        descripcion: entrada.descripcion,
      }),
    onSuccess: () => {
      setRegistrando(false);
      void queryClient.invalidateQueries();
    },
  });
  const contar = useMutation({
    mutationFn: (amount: bigint) =>
      countCash(deps, { owner: CURRENT_OWNER, amount: money(amount, 'COP') }),
    onSuccess: () => {
      setContando(false);
      void queryClient.invalidateQueries();
    },
  });
  const fondo: ViewStyle = { flex: 1, backgroundColor: theme.palette.background };

  if (cuenta.isPending || saldo.isPending || movimientos.isPending) {
    return (
      <View style={fondo}>
        <LoadingState />
      </View>
    );
  }
  if (cuenta.isError || saldo.isError || movimientos.isError || cuenta.data === null) {
    return (
      <View style={fondo}>
        <ErrorState
          description="No se pudo leer la cuenta."
          onRetry={() => {
            void queryClient.invalidateQueries();
          }}
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: cuenta.data.nombre }} />
      <FlatList
        style={fondo}
        data={movimientos.data.items}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MovementRow
            movement={item}
            onPress={() => {
              router.push({ pathname: '/movimientos/[id]', params: { id: item.id } });
            }}
          />
        )}
        ListHeaderComponent={
          <View style={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
            <View style={{ gap: theme.spacing.xs }}>
              <AppText level="apoyo" color="textSecondary">
                Saldo
              </AppText>
              <Money
                amount={saldo.data.amount}
                currency={saldo.data.currency}
                direction="neutro"
                size="montoGrande"
              />
            </View>
            {tarjeta.data !== undefined && tarjeta.data !== null && (
              <CardSummaryCard resumen={tarjeta.data} />
            )}
            {ciclo.data !== undefined && ciclo.data !== null && (
              <CycleCard check={ciclo.data} hoy={deps.clock()} />
            )}
            {conciliacion.data !== undefined && conciliacion.data !== null && (
              <DriftCard reconciliation={conciliacion.data} />
            )}
            {esEfectivo && (
              <Card>
                <AppText level="apoyo" color="textSecondary">
                  El efectivo entra solo con cada retiro. Lo que Sereno no puede ver: en qué se fue,
                  y cuánto tenías antes de empezar. Para eso están estos dos botones.
                </AppText>
                <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
                  <Button
                    label="Registrar un gasto"
                    onPress={() => {
                      setRegistrando(true);
                    }}
                    variant="secundario"
                  />
                  <Button
                    label="Contar el efectivo"
                    accessibilityLabel="Contar el efectivo: decir cuánto hay ahora"
                    onPress={() => {
                      setContando(true);
                    }}
                    variant="secundario"
                  />
                </View>
              </Card>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Sin movimientos"
            description="Todavía no ha pasado nada en esta cuenta."
          />
        }
      />
      <Modal
        visible={registrando}
        animationType="slide"
        onRequestClose={() => {
          setRegistrando(false);
        }}
      >
        <View style={fondo}>
          <CashExpenseForm
            onSubmit={(amount, descripcion) =>
              registrar.mutateAsync({ amount, descripcion }).then(() => undefined)
            }
            onCancel={() => {
              setRegistrando(false);
            }}
          />
        </View>
      </Modal>
      <Modal
        visible={contando}
        animationType="slide"
        onRequestClose={() => {
          setContando(false);
        }}
      >
        <View style={fondo}>
          <CashCountForm
            actual={saldo.data.amount}
            onSubmit={(amount) => contar.mutateAsync(amount).then(() => undefined)}
            onCancel={() => {
              setContando(false);
            }}
          />
        </View>
      </Modal>
    </>
  );
}
