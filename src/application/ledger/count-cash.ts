import type { OwnerId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import type { Transaction } from '@/domain/ledger/transaction';
import { formatCOP } from '@/domain/money/format';
import { isNegative, isZero, subtract, type Money } from '@/domain/money/money';

import { ensureSystemAccounts } from './ensure-system-accounts';
import { registerAdjustment, type LedgerDeps } from './register-adjustment';

/**
 * Conteo de efectivo: el usuario dice cuánto tiene en la billetera y Sereno
 * ajusta la diferencia.
 *
 * Es el saldo inicial del efectivo, y también su conciliación: ninguna fuente
 * digital ve la billetera, así que el «banco» aquí es contar los billetes. El
 * ajuste cuadra contra «Ajustes» con un motivo que dice qué había y qué hay;
 * si ya cuadra, no se asienta nada y se devuelve `null`.
 */
export async function countCash(
  deps: LedgerDeps,
  input: { owner: OwnerId; amount: Money; fecha?: string },
): Promise<Transaction | null> {
  if (isNegative(input.amount)) throw new Error('El efectivo no puede ser negativo');
  if (input.amount.currency !== 'COP') throw new Error('El efectivo se cuenta en pesos');

  await ensureSystemAccounts(deps.accounts, input.owner);
  const efectivo = systemAccountId('efectivo');
  const habia = await deps.accounts.balanceOf(efectivo);
  const diferencia = subtract(input.amount, habia);
  if (isZero(diferencia)) return null;

  return registerAdjustment(deps, {
    owner: input.owner,
    accountId: efectivo,
    amount: diferencia,
    motivo: `Conteo de efectivo: había $ ${formatCOP(habia.amount)}, hay $ ${formatCOP(input.amount.amount)}`,
    fecha: input.fecha,
  });
}
