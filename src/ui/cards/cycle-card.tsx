import { View } from 'react-native';

import type { CycleCheck } from '@/application/cards/verify-cycle';
import { formatShortDate, formatUpcoming } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_CICLO = {
  enCurso: 'Va del ciclo',
  cierra: (dia: string, hoy: string) => `Cierra ${formatUpcoming(dia, hoy)}`,
  porPagar: (dia: string, hoy: string) => `Se paga ${formatUpcoming(dia, hoy)}`,
  alDia: 'Pagado completo',
  adelantado: 'Pagaste más de lo del ciclo: abonaste a deuda anterior',
  financiado: 'Queda debiendo',
  financiadoAyuda:
    'Pagaste menos de lo que compraste. Lo que falta sigue como deuda de la tarjeta: es normal si difieres compras a cuotas.',
};

interface Props {
  check: CycleCheck;
  hoy: string;
}

/**
 * El ciclo de la tarjeta: cuánto va, cuándo cierra y cómo quedó.
 *
 * Pagar menos de lo comprado **no es un error** y no se pinta como tal: es
 * financiación, y decirlo con una alarma enseñaría a ignorar las alarmas.
 */
export function CycleCard({ check, hoy }: Props) {
  const theme = useTheme();
  const abierto = check.veredicto === 'sin-pago';

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText level="apoyo" color="textSecondary">
        {TEXTO_CICLO.enCurso} · {formatShortDate(`${check.ciclo.corte}T12:00:00.000-05:00`)} a{' '}
        {formatShortDate(`${check.ciclo.siguienteCorte}T12:00:00.000-05:00`)}
      </AppText>

      <Money
        amount={check.comprado.amount}
        currency={check.comprado.currency}
        direction="neutro"
        size="montoMediano"
        testID="ciclo-comprado"
      />

      <AppText level="apoyo" color="textSecondary">
        {abierto
          ? TEXTO_CICLO.cierra(check.ciclo.siguienteCorte, hoy)
          : TEXTO_CICLO.porPagar(check.ciclo.pago, hoy)}
      </AppText>

      {check.veredicto === 'al-dia' && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_CICLO.alDia}
        </AppText>
      )}

      {check.veredicto === 'adelantado' && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_CICLO.adelantado}
        </AppText>
      )}

      {check.veredicto === 'financiado' && (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_CICLO.financiado}
          </AppText>
          <Money
            amount={check.diferencia.amount}
            currency={check.diferencia.currency}
            direction="neutro"
            size="montoPequeno"
            testID="ciclo-financiado"
          />
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_CICLO.financiadoAyuda}
          </AppText>
        </View>
      )}
    </Card>
  );
}
