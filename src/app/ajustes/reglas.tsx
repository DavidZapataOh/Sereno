import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, ScrollView, View, type ViewStyle } from 'react-native';

import { listCategories } from '@/application/categorization/ensure-default-categories';
import {
  createRule,
  deleteRule,
  listRules,
  previewRule,
  type RuleDraft,
} from '@/application/categorization/rules';
import type { RuleField, RuleOperator } from '@/domain/categorization/rule';
import type { AccountId } from '@/domain/ledger/ids';
import { useAppDeps } from '@/infrastructure/composition/use-app-deps';
import { observability } from '@/infrastructure/observability';
import { CURRENT_OWNER } from '@/infrastructure/session/current-owner';
import { CategoryPicker } from '@/ui/categories/category-picker';
import { RuleRow } from '@/ui/categories/rule-row';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { EmptyState, ErrorState, LoadingState } from '@/ui/components/states';
import { TextField } from '@/ui/components/text-field';
import { useTheme } from '@/ui/theme/use-theme';

const CAMPOS: { valor: RuleField; etiqueta: string }[] = [
  { valor: 'comercio', etiqueta: 'el comercio' },
  { valor: 'descripcion', etiqueta: 'la descripción' },
];
const OPERADORES: { valor: RuleOperator; etiqueta: string }[] = [
  { valor: 'es', etiqueta: 'es' },
  { valor: 'empieza', etiqueta: 'empieza por' },
  { valor: 'contiene', etiqueta: 'contiene' },
];

/** ¿Cómo se clasifican automáticamente mis movimientos? */
export default function ReglasRoute() {
  const deps = useAppDeps();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [campo, setCampo] = useState<RuleField>('comercio');
  const [operador, setOperador] = useState<RuleOperator>('es');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<AccountId | null>(null);

  const reglas = useQuery({
    queryKey: ['rules', CURRENT_OWNER],
    queryFn: () => listRules(deps, CURRENT_OWNER),
  });
  const categorias = useQuery({
    queryKey: ['categories', CURRENT_OWNER],
    queryFn: () => listCategories(deps, CURRENT_OWNER),
  });
  const porId = new Map((categorias.data ?? []).map((c) => [c.id, c]));

  const borrador: RuleDraft | null =
    categoria === null || valor.trim().length < 2 ? null : { campo, operador, valor, categoria };
  const vistaPrevia = useQuery({
    queryKey: ['rule-preview', CURRENT_OWNER, campo, operador, valor.trim(), categoria],
    queryFn: () =>
      borrador === null
        ? Promise.resolve(null)
        : previewRule(deps, { owner: CURRENT_OWNER, draft: borrador }),
    enabled: borrador !== null,
  });

  const cerrar = (): void => {
    setCreando(false);
    setValor('');
    setCategoria(null);
  };
  const guardar = useMutation({
    mutationFn: (draft: RuleDraft) => createRule(deps, { owner: CURRENT_OWNER, draft }),
    onSuccess: () => {
      cerrar();
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      observability.captureError(error, { operacion: 'crear-regla' });
    },
  });
  const borrar = useMutation({
    mutationFn: (id: string) => deleteRule(deps, { owner: CURRENT_OWNER, id }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      observability.captureError(error, { operacion: 'borrar-regla' });
    },
  });
  const fondo: ViewStyle = { flex: 1, backgroundColor: theme.palette.background };

  if (reglas.isPending) {
    return (
      <View style={fondo}>
        <LoadingState />
      </View>
    );
  }
  if (reglas.isError) {
    return (
      <View style={fondo}>
        <ErrorState
          description="No se pudieron leer las reglas."
          onRetry={() => {
            void queryClient.invalidateQueries();
          }}
        />
      </View>
    );
  }

  const opciones = <T extends string>(
    lista: { valor: T; etiqueta: string }[],
    actual: T,
    elegir: (v: T) => void,
  ) => (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      {lista.map((o) => (
        <View key={o.valor} style={{ flex: 1 }}>
          <Button
            label={o.etiqueta}
            variant={o.valor === actual ? 'primario' : 'secundario'}
            onPress={() => {
              elegir(o.valor);
            }}
          />
        </View>
      ))}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Reglas' }} />
      <ScrollView
        style={fondo}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      >
        <AppText level="apoyo" color="textSecondary">
          Una regla clasifica lo que ya está y lo que llegue. Entre varias, gana la más específica;
          a igual especificidad, la más reciente. Lo que clasificaste a mano se respeta.
        </AppText>
        <Button
          label="Nueva regla"
          onPress={() => {
            setCreando(true);
          }}
        />
        {reglas.data.length === 0 ? (
          <EmptyState
            title="Todavía no tienes reglas"
            description="Puedes crearlas aquí, o desde Revisar con «Siempre que sea…»."
          />
        ) : (
          <Card style={{ padding: 0 }}>
            {reglas.data.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                categoria={porId.get(r.categoria)?.nombre}
                onDelete={() => {
                  Alert.alert('Borrar la regla', 'Lo ya clasificado se queda como está.', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Borrar',
                      style: 'destructive',
                      onPress: () => {
                        borrar.mutate(r.id);
                      },
                    },
                  ]);
                }}
              />
            ))}
          </Card>
        )}
      </ScrollView>

      <Modal visible={creando} animationType="slide" onRequestClose={cerrar}>
        <ScrollView
          style={fondo}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
        >
          <AppText level="subtitulo">Nueva regla</AppText>
          <AppText level="apoyo" color="textSecondary">
            Cuando…
          </AppText>
          {opciones(CAMPOS, campo, setCampo)}
          {opciones(OPERADORES, operador, setOperador)}
          <TextField
            label="Texto"
            value={valor}
            onChangeText={setValor}
            placeholder="exito"
            testID="valor-regla"
          />
          <AppText level="apoyo" color="textSecondary">
            … va a
          </AppText>
          <Button
            label={categoria === null ? 'Elegir categoría' : (porId.get(categoria)?.nombre ?? '')}
            variant="secundario"
            onPress={() => {
              setEligiendo(true);
            }}
          />
          {vistaPrevia.data !== null && vistaPrevia.data !== undefined && (
            <AppText level="apoyo" color="textSecondary">
              Aplicaría a {String(vistaPrevia.data.coinciden)} · cambiaría{' '}
              {String(vistaPrevia.data.cambiarian)} · respeta {String(vistaPrevia.data.respetadas)}{' '}
              que elegiste tú
            </AppText>
          )}
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancelar" variant="secundario" onPress={cerrar} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Guardar"
                disabled={borrador === null}
                loading={guardar.isPending}
                onPress={() => {
                  if (borrador !== null) guardar.mutate(borrador);
                }}
              />
            </View>
          </View>
        </ScrollView>
        <CategoryPicker
          visible={eligiendo}
          categories={categorias.data ?? []}
          selected={categoria}
          onSelect={(id) => {
            setCategoria(id);
            setEligiendo(false);
          }}
          onClose={() => {
            setEligiendo(false);
          }}
        />
      </Modal>
    </>
  );
}
