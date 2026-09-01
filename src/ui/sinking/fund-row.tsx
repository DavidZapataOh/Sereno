import { View } from 'react-native';

import type { FundState } from '@/application/sinking/manage-funds';
import { formatShortDate } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_FONDO = {
  llevas: 'Llevas apartado',
  falta: (cuando: string) => `Falta para ${cuando}`,
  esteMes: 'Este mes toca apartar',
  completo: 'Ya está completo',
  /**
   * Se dice antes de que llegue el cobro, que es cuando todavía se puede hacer
   * algo. Avisar el día del cobro sería informar del problema, no evitarlo.
   */
  noAlcanza: 'Con este ritmo no va a alcanzar para la fecha',
};

interface Props {
  estado: FundState;
}

/**
 * Un fondo: cuánto lleva, cuánto falta y qué toca este mes.
 *
 * Sin colores de alarma ni de premio (principio 3): un fondo completo se ve
 * completo y ya.
 */
export function FundRow({ estado }: Props) {
  const theme = useTheme();
  const completo = estado.falta.amount === 0n;

  return (
    <Card style={{ gap: theme.spacing.xs }}>
      <AppText level="cuerpo">{estado.fondo.nombre}</AppText>

      <AppText level="apoyo" color="textSecondary">
        {TEXTO_FONDO.llevas}
      </AppText>
      <Money
        amount={estado.apartado.amount}
        currency={estado.apartado.currency}
        direction="neutro"
        size="montoMediano"
      />

      {completo ? (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_FONDO.completo}
        </AppText>
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_FONDO.falta(formatShortDate(`${estado.fondo.proximaFecha}T12:00:00.000-05:00`))}
          </AppText>
          <Money
            amount={estado.falta.amount}
            currency={estado.falta.currency}
            direction="neutro"
            size="montoPequeno"
          />
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_FONDO.esteMes}
          </AppText>
          <Money
            amount={estado.aporteDeEsteMes.amount}
            currency={estado.aporteDeEsteMes.currency}
            direction="neutro"
            size="montoPequeno"
          />
          {!estado.alcanza && (
            <AppText level="apoyo" color="textSecondary">
              {TEXTO_FONDO.noAlcanza}
            </AppText>
          )}
        </View>
      )}
    </Card>
  );
}
