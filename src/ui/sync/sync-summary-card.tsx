import { View } from 'react-native';

import type { SyncSummary } from '@/application/sync/sync-portal';
import { formatCOP } from '@/domain/money/format';
import { formatShortDate } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { IconButton } from '@/ui/components/icon-button';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  summary: SyncSummary;
  onDismiss: () => void;
}

const plural = (n: number, uno: string, varios: string): string =>
  `${String(n)} ${n === 1 ? uno : varios}`;

export function SyncSummaryCard({ summary: s, onDismiss }: Props) {
  const theme = useTheme();
  const lineas = [
    s.nuevas === 0
      ? 'Nada nuevo desde la última vez'
      : plural(s.nuevas, 'movimiento nuevo', 'movimientos nuevos'),
    s.fusionadas > 0
      ? plural(s.fusionadas, 'visto también por otra fuente', 'vistos también por otra fuente')
      : null,
    s.duplicadas > 0 ? `${String(s.duplicadas)} ya estaban` : null,
    s.transferencias > 0
      ? plural(s.transferencias, 'transferencia detectada', 'transferencias detectadas')
      : null,
    s.omitidas > 0
      ? plural(s.omitidas, 'fila sin monto, omitida', 'filas sin monto, omitidas')
      : null,
    s.anteriores > 0 && s.desde !== null
      ? `${plural(s.anteriores, 'movimiento anterior', 'movimientos anteriores')} al ${formatShortDate(`${s.desde}T12:00:00.000-05:00`)} no cuentan: Sereno empieza ese día`
      : null,
    s.saldoInicial === null
      ? null
      : `Saldo inicial fijado en $ ${formatCOP(s.saldoInicial.amount)}: lo que había antes de estos movimientos`,
    s.conciliacion === null
      ? 'No vi el saldo del banco: abre «Cuentas» en el portal antes de importar'
      : `Saldo del banco: $ ${formatCOP(s.conciliacion.saldoReal.amount)} (${s.conciliacion.detalle})`,
    s.conciliacion === null
      ? null
      : s.conciliacion.veredicto === 'cuadra'
        ? 'Cuadra con lo que Sereno tiene'
        : 'No cuadra con lo que Sereno tiene: mira «Hoy»',
  ].filter((l): l is string => l !== null);

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        {lineas.map((linea, i) => (
          <AppText
            key={linea}
            level={i === 0 ? 'cuerpo' : 'apoyo'}
            color={i === 0 ? 'textPrimary' : 'textSecondary'}
          >
            {linea}
          </AppText>
        ))}
      </View>
      <IconButton icon="close" label="Cerrar" onPress={onDismiss} />
    </Card>
  );
}
