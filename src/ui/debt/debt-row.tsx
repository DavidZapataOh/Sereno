import type { DebtSummary } from '@/application/debt/list-debts';
import { absolute } from '@/domain/money/money';
import { ListRow } from '@/ui/components/list-row';

export const TEXTO_FILA_DEUDA = {
  tipo: {
    tarjeta: 'Tarjeta',
    prestamo: 'Préstamo',
    persona: 'A una persona',
  },
  sinDeclarar: 'Sin datos declarados',
  saldada: 'Saldada',
};

interface Props {
  deuda: DebtSummary;
  onPress?: () => void;
}

/**
 * Una deuda en la lista.
 *
 * Una deuda **saldada se queda en cero**, no desaparece: es historia, y verla
 * en cero es parte de lo que sostiene la constancia.
 */
export function DebtRow({ deuda, onPress }: Props) {
  const saldada = deuda.saldo.amount === 0n;
  const subtitulo = saldada
    ? TEXTO_FILA_DEUDA.saldada
    : deuda.terminos === null
      ? TEXTO_FILA_DEUDA.sinDeclarar
      : TEXTO_FILA_DEUDA.tipo[deuda.terminos.tipo];

  return (
    <ListRow
      title={deuda.nombre}
      subtitle={subtitulo}
      amount={absolute(deuda.saldo).amount}
      currency={deuda.saldo.currency}
      // Una deuda se enseña como «Debes», no como un saldo negativo: el
      // usuario no tiene menos trescientos mil, debe trescientos mil.
      direction={saldada ? 'neutro' : 'sale'}
      onPress={onPress}
    />
  );
}
