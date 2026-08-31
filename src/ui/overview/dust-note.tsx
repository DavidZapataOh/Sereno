import { View } from 'react-native';

import type { Money as MoneyValue } from '@/domain/money/money';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_POLVO = {
  explicacion: (cuantas: number) =>
    cuantas === 1
      ? 'Además, 1 saldo cripto de menos de un dólar, sumado en el total:'
      : `Además, ${String(cuantas)} saldos cripto de menos de un dólar, sumados en el total:`,
};

interface Props {
  cuantas: number;
  total: MoneyValue;
}

/**
 * El polvo cripto: se declara, no se calla.
 *
 * Con catorce cadenas, lo que queda suelto de cualquier movimiento llena la
 * lista de renglones de «0,000012» y esconde lo que importa. Pero **el
 * patrimonio los suma**, así que si no apareciera este renglón, sumar la lista
 * a mano no daría el total —y así es exactamente como David lo comprueba—.
 */
export function DustNote({ cuantas, total }: Props) {
  const theme = useTheme();
  if (cuantas === 0) return null;

  return (
    <View style={{ paddingTop: theme.spacing.md, gap: theme.spacing.xs }}>
      <AppText level="apoyo" color="textSecondary">
        {TEXTO_POLVO.explicacion(cuantas)}
      </AppText>
      <Money
        amount={total.amount}
        currency={total.currency}
        direction="neutro"
        size="montoPequeno"
      />
    </View>
  );
}
