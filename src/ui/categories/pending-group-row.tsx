import type { PendingGroup } from '@/application/categorization/review';
import type { Category } from '@/domain/categorization/category';
import type { AccountId } from '@/domain/ledger/ids';
import { ListRow } from '@/ui/components/list-row';

interface Props {
  group: PendingGroup;
  categorias: Map<AccountId, Category>;
  onPress: () => void;
  testID?: string;
}

/** Un comercio pendiente: cuántos movimientos, cuánto suman, y qué sugiere Sereno. */
export function PendingGroupRow({ group, categorias, onPress, testID }: Props) {
  const n = group.transacciones.length;
  const sugerida = group.sugerida === null ? null : categorias.get(group.sugerida)?.nombre;
  const subtitle = [
    `${String(n)} ${n === 1 ? 'movimiento' : 'movimientos'}`,
    sugerida === null || sugerida === undefined ? null : `Sereno sugiere: ${sugerida}`,
  ]
    .filter((x): x is string => x !== null)
    .join(' · ');
  return (
    <ListRow
      testID={testID}
      title={group.comercio.nombre}
      subtitle={subtitle}
      amount={group.total.amount}
      currency={group.total.currency}
      direction="sale"
      onPress={onPress}
    />
  );
}
