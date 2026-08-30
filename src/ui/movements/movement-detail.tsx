import { Pressable, ScrollView, View, type PressableStateCallbackType } from 'react-native';

import type { MovementDetail as Detail } from '@/application/movements/movements';
import type { Classification } from '@/domain/categorization/classification';
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
  /** Abre el selector de categoría. Sin esto, la fila de categoría no se puede tocar. */
  onChangeCategory?: () => void;
  busy?: boolean;
}

/** El origen de una clasificación, en palabras: nunca solo color (principio 2). */
export function classificationOrigin(c: Classification | null): string {
  if (c === null) return 'Por clasificar';
  switch (c.origen) {
    case 'manual':
      return 'Lo elegiste tú';
    case 'regla':
      return 'Por una regla tuya';
    case 'aprendida':
      return `Clasificado solo (${String(c.confianza)} % seguro)`;
    case 'catalogo':
      return 'Por el catálogo de comercios';
  }
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
  onChangeCategory,
  busy = false,
}: Props) {
  const theme = useTheme();
  const { vista, transaccion, cuentas, observaciones, transferencia } = detalle;
  const titulo = vista.esTransferencia ? vista.descripcion : vista.comercio.nombre;
  const nombreCategoria = vista.categoria?.nombre ?? 'Por clasificar';
  const origen = classificationOrigin(vista.clasificacion);

  return (
    <ScrollView
      style={{ backgroundColor: theme.palette.background }}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="subtitulo">{titulo}</AppText>
        {titulo !== vista.descripcion && (
          <AppText level="micro" color="textMuted" numberOfLines={2}>
            {vista.descripcion}
          </AppText>
        )}
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

      {!vista.esTransferencia && (
        <Pressable
          onPress={onChangeCategory}
          disabled={onChangeCategory === undefined}
          accessibilityRole="button"
          accessibilityLabel={`Categoría: ${nombreCategoria}. ${origen}. Toca para cambiarla`}
          testID="fila-categoria"
          style={({ pressed }: PressableStateCallbackType) => ({
            minHeight: theme.touchTargetMin,
            justifyContent: 'center',
            padding: theme.spacing.lg,
            borderRadius: theme.radius.grande,
            borderWidth: 1,
            borderColor: theme.palette.border,
            backgroundColor: pressed ? theme.palette.surfacePressed : theme.palette.surface,
          })}
        >
          <AppText level="micro" color="textMuted">
            Categoría
          </AppText>
          <AppText level="cuerpo">{nombreCategoria}</AppText>
          <AppText level="apoyo" color="textSecondary">
            {origen}
          </AppText>
        </Pressable>
      )}

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
