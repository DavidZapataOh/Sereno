import { View } from 'react-native';

import type { Rule } from '@/domain/categorization/rule';
import { AppText } from '@/ui/components/app-text';
import { IconButton } from '@/ui/components/icon-button';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  rule: Rule;
  /** Nombre de la categoría destino; si la categoría ya no existe, se dice. */
  categoria: string | undefined;
  onDelete: () => void;
}

const CAMPO: Record<Rule['campo'], string> = {
  comercio: 'el comercio',
  descripcion: 'la descripción',
};
const OPERADOR: Record<Rule['operador'], string> = {
  es: 'es',
  empieza: 'empieza por',
  contiene: 'contiene',
};

/** «Cuando el comercio es “panaderia dona” → Cafés y antojos», en llano. */
export function ruleSentence(rule: Rule, categoria: string | undefined): string {
  return `Cuando ${CAMPO[rule.campo]} ${OPERADOR[rule.operador]} «${rule.valor}» → ${categoria ?? 'una categoría que ya no existe'}`;
}

export function RuleRow({ rule, categoria, onDelete }: Props) {
  const theme = useTheme();
  return (
    <View
      style={{
        minHeight: theme.touchTargetMin,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingLeft: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText>{ruleSentence(rule, categoria)}</AppText>
      </View>
      <IconButton
        icon="delete"
        label={`Borrar la regla ${ruleSentence(rule, categoria)}`}
        onPress={onDelete}
      />
    </View>
  );
}
