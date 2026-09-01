import { View } from 'react-native';

import type { Money as MoneyValue } from '@/domain/money/money';
import { calendarDay } from '@/domain/time/colombia';
import { formatRelative } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_OVERVIEW = {
  sinValorar: 'Hay saldo que todavía no se pudo pasar a pesos, y no está sumado aquí',
  /**
   * Solo cuando la tasa no es de hoy. Una tasa vieja da una cifra que parece
   * buena y no lo es, y callarlo es dejar que se lea como actual.
   */
  tasaVieja: (cuando: string) => `Valorado con tasas de ${cuando}`,
};

interface Props {
  patrimonio: MoneyValue;
  /** Saldos en otra moneda que no están sumados en el patrimonio. */
  sinValorar?: MoneyValue[];
  /** El momento de la tasa más vieja que se usó, si se usó alguna. */
  tasaMasVieja?: string | null;
  ultimaSincronizacion: string | null;
  now: string;
}

/** La cifra que responde «¿cuánto tengo?», y de cuándo es. */
export function OverviewHeader({
  patrimonio,
  sinValorar = [],
  tasaMasVieja = null,
  ultimaSincronizacion,
  now,
}: Props) {
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
      {/* Solo si no son de hoy. Decir «tasas de hoy» todos los días es ruido;
          callar que son de hace tres es dejar que se lean como actuales. */}
      {tasaMasVieja !== null && calendarDay(tasaMasVieja) !== calendarDay(now) && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_OVERVIEW.tasaVieja(formatRelative(tasaMasVieja, now))}
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
