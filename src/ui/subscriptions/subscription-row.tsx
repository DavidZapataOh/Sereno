import { View } from 'react-native';

import type { SubscriptionView } from '@/application/subscriptions/list-subscriptions';
import type { Cadence } from '@/domain/subscriptions/cadence';
import { formatUpcoming } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const CADENCIA: Record<Cadence, string> = {
  quincenal: 'Cada quince días',
  mensual: 'Cada mes',
  bimestral: 'Cada dos meses',
  trimestral: 'Cada tres meses',
  anual: 'Cada año',
};

export const TEXTO_SUSCRIPCIONES = {
  cancelada: 'Parece que ya no se cobra',
  probable: 'Puede que no sea una suscripción',
  subio: (pct: number) => `Subió un ${Math.abs(Math.round(pct)).toString()} %`,
  bajo: (pct: number) => `Bajó un ${Math.abs(Math.round(pct)).toString()} %`,
  pronto: 'Se cobra en los próximos días',
};

/** Por debajo de esto, la detección es una conjetura y así se presenta. */
const CONFIANZA_BAJA = 0.5;

interface Props {
  sub: SubscriptionView;
  hoy: string;
}

/**
 * Una suscripción en la lista.
 *
 * Dice tres cosas: quién cobra, cuánto, y cuándo vuelve. Lo demás —que subió
 * de precio, que parece cancelada, que la detección no es segura— solo aparece
 * cuando aplica: una fila con cuatro etiquetas no se lee.
 */
export function SubscriptionRow({ sub, hoy }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <AppText level="cuerpo">{sub.comercio}</AppText>
        <Money
          amount={sub.monto.amount}
          currency={sub.monto.currency}
          direction="neutro"
          size="montoPequeno"
        />
      </View>

      <AppText level="apoyo" color="textSecondary">
        {sub.proximoCobro === null
          ? TEXTO_SUSCRIPCIONES.cancelada
          : `${CADENCIA[sub.cadencia]} · se cobra ${formatUpcoming(sub.proximoCobro, hoy)}`}
      </AppText>

      {sub.cambio !== null && (
        <AppText level="apoyo" color="textSecondary">
          {sub.cambio.porcentaje > 0
            ? TEXTO_SUSCRIPCIONES.subio(sub.cambio.porcentaje)
            : TEXTO_SUSCRIPCIONES.bajo(sub.cambio.porcentaje)}
        </AppText>
      )}

      {/* Es una conjetura, no un hecho, y decirlo cambia cómo se lee la fila. */}
      {sub.confianza < CONFIANZA_BAJA && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_SUSCRIPCIONES.probable}
        </AppText>
      )}
    </Card>
  );
}
