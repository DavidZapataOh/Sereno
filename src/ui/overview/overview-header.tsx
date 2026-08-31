import { View } from 'react-native';

import type { Money as MoneyValue } from '@/domain/money/money';
import { formatRelative } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_OVERVIEW = {
  sinValorar: 'Hay saldo que todavía no se pudo pasar a pesos, y no está sumado aquí',
};

interface Props {
  patrimonio: MoneyValue;
  /** Saldos en otra moneda que no están sumados en el patrimonio. */
  sinValorar?: MoneyValue[];
  ultimaSincronizacion: string | null;
  now: string;
}

/** La cifra que responde «¿cuánto tengo?», y de cuándo es. */
export function OverviewHeader({ patrimonio, sinValorar = [], ultimaSincronizacion, now }: Props) {
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
      {sinValorar.length > 0 && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_OVERVIEW.sinValorar}
        </AppText>
      )}
      <AppText level="micro" color="textMuted">
        {ultimaSincronizacion === null
          ? 'Todavía no se ha sincronizado'
          : `Sincronizado ${formatRelative(ultimaSincronizacion, now)}`}
      </AppText>
    </View>
  );
}
