import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { addWallet, listWallets, removeWallet } from '@/application/crypto/manage-wallets';
import { walletAccountId } from '@/application/crypto/sync-wallets';
import { CADENAS_DE, tokensDe } from '@/domain/crypto/wallet';
import { zero } from '@/domain/money/money';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { observability } from '@/infrastructure/observability';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { TextField } from '@/ui/components/text-field';
import { WalletCard, type SaldoEnPantalla } from '@/ui/crypto/wallet-card';
import { useTheme } from '@/ui/theme/use-theme';

const TEXTO = {
  titulo: 'Wallets',
  explicacion:
    'Solo la dirección pública. Sereno nunca pide ni guarda una clave privada ni una frase semilla: con la dirección basta para leer el saldo.',
  redes:
    'No hace falta decir en qué red está: Sereno la reconoce por la dirección, y una dirección EVM se mira en las catorce cadenas.',
  nombre: 'Nombre',
  direccion: 'Dirección pública',
  anadir: 'Añadir wallet',
  vacio: 'Todavía no sigues ninguna wallet.',
  vacioAyuda: 'Pega tu dirección pública y Sereno leerá el saldo solo.',
  noSePudoLeer: 'No se pudieron leer las wallets.',
};

/** ¿Qué direcciones mira Sereno en la cadena, y cuándo las leyó? */
export default function WalletsRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [direccion, setDireccion] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const wallets = useQuery({
    queryKey: ['wallets', CURRENT_OWNER],
    queryFn: async () => {
      const estados = await listWallets(deps, CURRENT_OWNER);
      // El saldo no vive en la wallet: vive en el ledger, en la cuenta de cada
      // token. Se lee de ahí para que sea el mismo número que suma el
      // patrimonio, y no una segunda versión que puede discrepar.
      return Promise.all(
        estados.map(async (estado) => ({
          ...estado,
          // Todos los tokens de todas las cadenas de su red. Los que dan cero
          // no tienen cuenta en el ledger —serían casi treinta cuentas vacías—,
          // así que no se listan: lo que importa aquí es dónde sí hay algo.
          saldos: (
            await Promise.all(
              CADENAS_DE[estado.red].flatMap((chain) =>
                tokensDe(chain).map(async (token): Promise<SaldoEnPantalla> => {
                  const id = walletAccountId(estado, chain, token.simbolo);
                  const cuenta = await deps.accounts.findById(id);
                  return {
                    chain,
                    simbolo: token.simbolo,
                    saldo:
                      cuenta === null ? zero(token.currency) : await deps.accounts.balanceOf(id),
                  };
                }),
              ),
            )
          ).filter((s) => s.saldo.amount > 0n),
        })),
      );
    },
  });

  const anadir = useMutation({
    mutationFn: () => addWallet(deps, { owner: CURRENT_OWNER, direccion, nombre }),
    onSuccess: () => {
      setDireccion('');
      setNombre('');
      setError(undefined);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => {
      setError(e.message);
      observability.captureError(e, { operacion: 'anadir-wallet' });
    },
  });

  const borrar = useMutation({
    mutationFn: (id: string) => removeWallet(deps, id),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });

  const ahora = deps.clock();

  return (
    <>
      <Stack.Screen options={{ title: TEXTO.titulo }} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO.explicacion}
        </AppText>

        <Card style={{ gap: theme.spacing.md }}>
          <AppText level="subtitulo">{TEXTO.anadir}</AppText>

          <TextField label={TEXTO.nombre} value={nombre} onChangeText={setNombre} />
          <TextField
            label={TEXTO.direccion}
            value={direccion}
            onChangeText={setDireccion}
            error={error}
            testID="wallet-direccion"
          />
          <Button
            label={TEXTO.anadir}
            onPress={() => {
              anadir.mutate();
            }}
            loading={anadir.isPending}
          />
        </Card>

        {wallets.isPending && <LoadingState />}
        {wallets.isError && (
          <ErrorState
            description={TEXTO.noSePudoLeer}
            onRetry={() => {
              void wallets.refetch();
            }}
          />
        )}
        {wallets.data?.length === 0 && (
          <EmptyState title={TEXTO.vacio} description={TEXTO.vacioAyuda} />
        )}
        {wallets.data?.map((estado) => (
          <WalletCard
            key={estado.id}
            estado={estado}
            ahora={ahora}
            onBorrar={() => {
              Alert.alert(TEXTO.titulo, `¿Dejar de seguir «${estado.nombre}»?`, [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Dejar de seguir',
                  style: 'destructive',
                  onPress: () => {
                    borrar.mutate(estado.id);
                  },
                },
              ]);
            }}
          />
        ))}
      </ScrollView>
    </>
  );
}
