import type { MovementView } from '@/application/movements/movements';
import { formatShortDate } from '@/domain/time/format';
import { ListRow } from '@/ui/components/list-row';

interface Props {
  movement: MovementView;
  onPress: () => void;
}

export function MovementRow({ movement: m, onPress }: Props) {
  const subtitle = m.esTransferencia
    ? `${m.cuenta.nombre} → ${m.contraparte?.nombre ?? ''}`
    : [formatShortDate(m.fecha), m.cuenta.nombre, m.sinClasificar ? 'Sin clasificar' : null]
        .filter((x): x is string => x !== null)
        .join(' · ');

  return (
    <ListRow
      title={m.descripcion}
      subtitle={subtitle}
      amount={m.monto.amount}
      currency={m.monto.currency}
      direction={m.direction}
      onPress={onPress}
    />
  );
}
