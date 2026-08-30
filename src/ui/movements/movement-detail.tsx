import { ScrollView, View } from 'react-native';

import type { MovementDetail as Detail } from '@/application/movements/movements';
import { absolute, isNegative } from '@/domain/money/money';
import { formatLongDate, formatShortDate } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  detalle: Detail;
  onConfirmTransfer?: () => void;
  onUndoTransfer?: () => void;
  busy?: boolean;
}

const FUENTES: Record<string, string> = {
  bancolombia: 'Bancolombia',
  nequi: 'Nequi',
  manual: 'Registrado a mano',
};

export function MovementDetail({
  detalle,
  onConfirmTransfer,
  onUndoTransfer,
  busy = false,
}: Props) {
  const theme = useTheme();
  const { vista, transaccion, cuentas, observaciones, transferencia } = detalle;

  return (
    <ScrollView
      style={{ backgroundColor: theme.palette.background }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="subtitulo">{vista.descripcion}</AppText>
        <Money
          amount={vista.monto.amount}
          currency={vista.monto.currency}
          direction={vista.direction}
          size="montoGrande"
        />
        <AppText level="apoyo" color="textSecondary">
          {formatLongDate(vista.fecha)}
        </AppText>
      </View>

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText level="micro" color="textMuted">
          Apuntes
        </AppText>
        {transaccion.postings.map((p) => (
          <View
            key={`${p.accountId}-${p.amount.amount.toString()}`}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}
          >
            <AppText numberOfLines={1}>{cuentas.get(p.accountId)?.nombre ?? p.accountId}</AppText>
            <Money
              amount={absolute(p.amount).amount}
              currency={p.amount.currency}
              direction={isNegative(p.amount) ? 'sale' : 'entra'}
              size="montoPequeno"
            />
          </View>
        ))}
      </Card>

      {observaciones.length > 0 && (
        <Card style={{ gap: theme.spacing.xs }}>
          <AppText level="micro" color="textMuted">
            Origen
          </AppText>
          {observaciones.map((o) => (
            <AppText key={o.id} level="apoyo" color="textSecondary">
              {`Visto por ${FUENTES[o.fuente] ?? o.fuente} · ${formatShortDate(o.capturadoEn)}`}
            </AppText>
          ))}
        </Card>
      )}

      {transferencia !== null && transferencia.estado === 'detectada' && (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText>Sereno cree que esto es una transferencia entre tus cuentas.</AppText>
          {onConfirmTransfer !== undefined && (
            <Button label="Sí, es una transferencia" onPress={onConfirmTransfer} loading={busy} />
          )}
          {onUndoTransfer !== undefined && (
            <Button
              label="No, son dos cosas distintas"
              onPress={onUndoTransfer}
              variant="secundario"
              disabled={busy}
            />
          )}
        </Card>
      )}
      {transferencia !== null && transferencia.estado === 'confirmada' && (
        <AppText level="apoyo" color="ingreso">
          Transferencia confirmada
        </AppText>
      )}
    </ScrollView>
  );
}
