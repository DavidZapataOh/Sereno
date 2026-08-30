import type { Account } from '@/domain/ledger/account';
import { absolute, isNegative, type Money } from '@/domain/money/money';
import { ListRow } from '@/ui/components/list-row';

interface Props {
  account: Account;
  saldo: Money;
  onPress: () => void;
}

const ETIQUETA: Record<Account['kind'], string> = {
  activo: 'Cuenta',
  pasivo: 'Debes',
  ingreso: 'Ingresos',
  gasto: 'Gastos',
  patrimonio: 'Patrimonio',
};

/**
 * Un pasivo se muestra como deuda: «Debes» y signo de salida. Mostrar
 * «−$ 300.000» a secas como saldo de una tarjeta confunde: el usuario no
 * tiene menos trescientos mil, debe trescientos mil.
 */
export function AccountRow({ account, saldo, onPress }: Props) {
  const esPasivo = account.kind === 'pasivo';
  const direction = esPasivo || isNegative(saldo) ? 'sale' : 'neutro';
  return (
    <ListRow
      title={account.nombre}
      subtitle={ETIQUETA[account.kind]}
      amount={absolute(saldo).amount}
      currency={saldo.currency}
      direction={direction}
      onPress={onPress}
    />
  );
}
