import { View } from 'react-native';

import type { Reconciliation } from '@/domain/reconciliation/reconciliation';
import { formatLongDate } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  reconciliation: Reconciliation;
  onAdjust?: () => void;
}

/**
 * La diferencia de conciliación en lenguaje llano.
 *
 * Nunca en `peligro`: que el banco tenga menos de lo que el ledger cree es
 * información, no un error del sistema (principio 3). Y nunca redondeada.
 */
export function DriftCard({ reconciliation: r, onAdjust }: Props) {
  const theme = useTheme();
  const cuadra = r.veredicto === 'cuadra';
  const titulo = cuadra
    ? 'Cuadra con el banco'
    : r.veredicto === 'gasto-no-capturado'
      ? 'Salieron sin que Sereno lo viera'
      : 'Entraron sin que Sereno lo viera';

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText level="subtitulo" color={cuadra ? 'ingreso' : 'textPrimary'}>
        {titulo}
      </AppText>
      {!cuadra && (
        <Money
          amount={r.diferencia.amount}
          currency={r.diferencia.currency}
          direction={r.veredicto === 'gasto-no-capturado' ? 'sale' : 'entra'}
        />
      )}
      <AppText level="apoyo" color="textSecondary">
        {`Comparado con ${r.detalle} el ${formatLongDate(r.fecha)}`}
      </AppText>
      {!cuadra && onAdjust !== undefined && (
        <View style={{ marginTop: theme.spacing.xs }}>
          <Button label="Asumir la diferencia" onPress={onAdjust} variant="secundario" />
        </View>
      )}
    </Card>
  );
}
