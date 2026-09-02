import type { MovementView } from '@/application/movements/movements';
import { ListRow } from '@/ui/components/list-row';

import { MerchantAvatar } from './merchant-avatar';

interface Props {
  movement: MovementView;
  onPress: () => void;
}

export function MovementRow({ movement: m, onPress }: Props) {
  const titulo = m.esTransferencia ? m.descripcion : m.comercio.nombre;

  // **La fecha ya no va aquí**: la pone la cabecera del día. Repetirla en cada
  // fila era ruido en el sitio donde menos cabe, y ocupaba el hueco de lo que
  // sí distingue un movimiento de otro: de qué cuenta salió y en qué categoría
  // quedó.
  const subtitle = m.esTransferencia
    ? `${m.cuenta.nombre} → ${m.contraparte?.nombre ?? ''}`
    : [m.cuenta.nombre, m.categoria?.nombre ?? 'Por clasificar'].join(' · ');

  return (
    <ListRow
      leading={
        <MerchantAvatar
          nombre={titulo}
          sinClasificar={!m.esTransferencia && m.categoria === null}
        />
      }
      title={titulo}
      subtitle={subtitle}
      amount={m.monto.amount}
      currency={m.monto.currency}
      direction={m.direction}
      onPress={onPress}
    />
  );
}
