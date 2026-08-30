import { Pressable, View, type PressableStateCallbackType } from 'react-native';

import type { CurrencyCode } from '@/domain/money/currency';
import { currencyName, formatAmount, type MoneyDirection } from '@/domain/money/format';
import { useTheme } from '@/ui/theme/use-theme';

import { AppText } from './app-text';
import { Money } from './money';

interface Props {
  title: string;
  subtitle?: string;
  amount: bigint | number;
  currency?: CurrencyCode;
  direction: MoneyDirection;
  onPress?: () => void;
  testID?: string;
}

const VERBO: Record<MoneyDirection, string> = {
  entra: 'Entran',
  sale: 'Salen',
  neutro: 'Son',
};

/**
 * Fila de lista con monto.
 *
 * Al lector de pantalla se anuncia como una sola unidad. Sin eso, TalkBack lee
 * tres elementos sueltos —comercio, categoría, cifra— y el usuario tiene que
 * reconstruir mentalmente a qué pertenece cada uno.
 */
export function ListRow({
  title,
  subtitle,
  amount,
  currency = 'COP',
  direction,
  onPress,
  testID,
}: Props) {
  const theme = useTheme();

  const etiqueta = [
    title,
    subtitle,
    `${VERBO[direction]} ${formatAmount(amount, currency)} ${currencyName(currency)}`,
  ]
    .filter((parte): parte is string => parte !== undefined && parte.length > 0)
    .join('. ');

  const contenido = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: theme.touchTargetMin,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText
          level="cuerpo"
          numberOfLines={1}
          testID={testID === undefined ? undefined : `${testID}-titulo`}
        >
          {title}
        </AppText>
        {subtitle !== undefined && (
          <AppText level="apoyo" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>
      <Money amount={amount} currency={currency} direction={direction} size="montoPequeno" />
    </View>
  );

  if (onPress === undefined) {
    return (
      <View testID={testID} accessible accessibilityLabel={etiqueta}>
        {contenido}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={({ pressed }: PressableStateCallbackType) => ({
        minHeight: theme.touchTargetMin,
        backgroundColor: pressed ? theme.palette.surfacePressed : undefined,
      })}
    >
      {contenido}
    </Pressable>
  );
}
