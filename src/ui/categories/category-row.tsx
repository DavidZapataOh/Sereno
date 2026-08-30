import { Pressable, View, type PressableStateCallbackType } from 'react-native';

import type { CategorySpending } from '@/application/categorization/spending';
import { currencyName, formatAmount } from '@/domain/money/format';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

import { CategoryIcon } from './category-icon';

interface Props {
  spending: CategorySpending;
  onPress: () => void;
  testID?: string;
}

/** Una categoría con lo que se fue a ella en el periodo. */
export function CategoryRow({ spending, onPress, testID }: Props) {
  const theme = useTheme();
  const { categoria, total } = spending;
  const direction = categoria.kind === 'gasto' ? 'sale' : 'entra';
  const etiqueta = `${categoria.nombre}. ${direction === 'sale' ? 'Salen' : 'Entran'} ${formatAmount(total.amount, total.currency)} ${currencyName(total.currency)}`;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
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
      <CategoryIcon icono={categoria.icono} />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1}>{categoria.nombre}</AppText>
      </View>
      <Money
        amount={total.amount}
        currency={total.currency}
        direction={direction}
        size="montoPequeno"
      />
    </Pressable>
  );
}
