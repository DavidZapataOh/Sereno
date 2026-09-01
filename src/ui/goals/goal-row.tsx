import { View } from 'react-native';

import type { GoalState } from '@/application/goals/goal-progress';
import { formatShortDate } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_META = {
  llevas: 'Llevas',
  para: (cuando: string) => `Para ${cuando}`,
  esteMes: 'Este mes toca apartar',
  cumplida: 'Meta cumplida',
  ritmo: {
    adelantado: 'Vas adelantado',
    'al-dia': 'Vas al día',
    atrasado: 'Vas atrasado',
  },
  /** Se dice sin regañar: quien mira esto ya sabe que va apretado. */
  noCabe: 'Con lo que ganas, apartar esto cada mes no cabe',
};

interface Props {
  estado: GoalState;
}

/**
 * Una meta: cuánto lleva, para cuándo, y si va al ritmo.
 *
 * Sin confeti al cumplirla y sin regañar al ir atrasado (principio 3): las dos
 * cosas convierten una herramienta en un juez.
 */
export function GoalRow({ estado }: Props) {
  const theme = useTheme();
  const cumplida = estado.falta.amount === 0n;

  return (
    <Card style={{ gap: theme.spacing.xs }}>
      <AppText level="cuerpo">{estado.fondo.nombre}</AppText>

      <AppText level="apoyo" color="textSecondary">
        {TEXTO_META.llevas}
      </AppText>
      <Money
        amount={estado.apartado.amount}
        currency={estado.apartado.currency}
        direction="neutro"
        size="montoMediano"
      />

      {cumplida ? (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_META.cumplida}
        </AppText>
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_META.para(formatShortDate(`${estado.fondo.proximaFecha}T12:00:00.000-05:00`))}
          </AppText>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_META.ritmo[estado.ritmo.estado]}
          </AppText>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_META.esteMes}
          </AppText>
          <Money
            amount={estado.aporteDeEsteMes.amount}
            currency={estado.aporteDeEsteMes.currency}
            direction="neutro"
            size="montoPequeno"
          />
        </View>
      )}
    </Card>
  );
}
