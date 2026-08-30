import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View, type PressableStateCallbackType } from 'react-native';

import type { Category } from '@/domain/categorization/category';
import { CATEGORY_GROUPS, GROUP_NAMES } from '@/domain/categorization/taxonomy';
import type { AccountId } from '@/domain/ledger/ids';
import { stripAccents } from '@/domain/text/bank-description';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { TextField } from '@/ui/components/text-field';
import { useTheme } from '@/ui/theme/use-theme';

import { CategoryIcon } from './category-icon';

interface Props {
  visible: boolean;
  categories: Category[];
  selected: AccountId | null;
  onSelect: (id: AccountId) => void;
  onClose: () => void;
  title?: string;
}

const normalizar = (texto: string): string => stripAccents(texto).toLowerCase();

/**
 * El selector de categoría, el mismo en el detalle, en Revisar y en Reglas.
 * Secciones por grupo, buscador arriba, y la elegida se dice con palabras
 * («Elegida») además del icono: nunca solo color.
 */
export function CategoryPicker({
  visible,
  categories,
  selected,
  onSelect,
  onClose,
  title = 'Elige una categoría',
}: Props) {
  const theme = useTheme();
  const [busqueda, setBusqueda] = useState('');
  const filtro = normalizar(busqueda.trim());
  const secciones = useMemo(
    () =>
      CATEGORY_GROUPS.map((grupo) => ({
        grupo,
        nombre: GROUP_NAMES[grupo],
        categorias: categories.filter(
          (c) => c.grupo === grupo && (filtro === '' || normalizar(c.nombre).includes(filtro)),
        ),
      })).filter((s) => s.categorias.length > 0),
    [categories, filtro],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.palette.background }}>
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <AppText level="subtitulo">{title}</AppText>
          <TextField
            label="Buscar"
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Mercado, arriendo, taxi…"
            testID="buscar-categoria"
          />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}>
          {secciones.map((seccion) => (
            <View key={seccion.grupo}>
              <View
                style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xs }}
              >
                <AppText level="micro" color="textMuted">
                  {seccion.nombre.toUpperCase()}
                </AppText>
              </View>
              {seccion.categorias.map((c) => {
                const elegida = c.id === selected;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      onSelect(c.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={elegida ? `${c.nombre}. Elegida` : c.nombre}
                    accessibilityState={{ selected: elegida }}
                    testID={`categoria-${c.id}`}
                    style={({ pressed }: PressableStateCallbackType) => ({
                      minHeight: theme.touchTargetMin,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      paddingHorizontal: theme.spacing.lg,
                      paddingVertical: theme.spacing.sm,
                      backgroundColor: pressed ? theme.palette.surfacePressed : undefined,
                    })}
                  >
                    <CategoryIcon icono={c.icono} />
                    <AppText numberOfLines={1}>{c.nombre}</AppText>
                    <View style={{ flex: 1 }} />
                    {elegida && (
                      <AppText level="apoyo" color="accent">
                        Elegida
                      </AppText>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {secciones.length === 0 && (
            <View style={{ padding: theme.spacing.lg }}>
              <AppText level="apoyo" color="textSecondary">
                Ninguna categoría se llama así.
              </AppText>
            </View>
          )}
        </ScrollView>
        <View style={{ padding: theme.spacing.lg }}>
          <Button label="Cancelar" onPress={onClose} variant="secundario" />
        </View>
      </View>
    </Modal>
  );
}
