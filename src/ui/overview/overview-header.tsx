import { View } from 'react-native';

import type { Money as MoneyValue } from '@/domain/money/money';
import { formatRelative } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  patrimonio: MoneyValue;
  ultimaSincronizacion: string | null;
  now: string;
}

/** La cifra que responde «¿cuánto tengo?», y de cuándo es. */
export function OverviewHeader({ patrimonio, ultimaSincronizacion, now }: Props) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText level="apoyo" color="textSecondary">
        Tu patrimonio
      </AppText>
      <Money
        amount={patrimonio.amount}
        currency={patrimonio.currency}
        direction="neutro"
        size="montoGrande"
      />
      <AppText level="micro" color="textMuted">
        {ultimaSincronizacion === null
          ? 'Todavía no se ha sincronizado'
          : `Sincronizado ${formatRelative(ultimaSincronizacion, now)}`}
      </AppText>
    </View>
  );
}
