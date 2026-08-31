import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import type { Transaction } from '@/domain/ledger/transaction';
import { formatCOP } from '@/domain/money/format';
import { isNegative, isZero, type Money } from '@/domain/money/money';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import { registerAdjustment, type LedgerDeps } from '../ledger/register-adjustment';

/**
 * Poner al día lo que se debe en una tarjeta.
 *
 * Es el equivalente de `countCash` para una deuda, y existe por el mismo
 * motivo. Sereno cuenta desde el día en que se conecta la cuenta, así que solo
 * ve las compras y los pagos posteriores. Para una cuenta de ahorros eso basta
 * porque el portal declara el saldo y se asienta como saldo inicial; para una
 * tarjeta no hay portal, y sin punto de partida la deuda arranca en cero.
 *
 * Una tarjeta que dice tener el cupo entero disponible cuando no lo tiene es
 * peor que una que no dice nada: invita a gastar plata que no hay. Lo cazó
 * David en la sesión de campo del sprint 07.
 *
 * Se puede repetir cuando se quiera: es también la conciliación de la tarjeta,
 * igual que contar el efectivo lo es de la billetera. Si ya cuadra, no asienta
 * nada y devuelve `null`.
 */
export async function reconcileCardDebt(
  deps: LedgerDeps,
  input: { owner: OwnerId; accountId: AccountId; deuda: Money; fecha?: string },
): Promise<Transaction | null> {
  if (isNegative(input.deuda)) {
    // Deber menos que nada no existe. Si la tarjeta tiene saldo a favor, es un
    // caso distinto y merece su propio nombre, no un número negativo aquí.
    throw new Error('La deuda no puede ser negativa');
  }

  const cuenta = await deps.accounts.findById(input.accountId);
  if (cuenta === null || cuenta.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.accountId}"`);
  }
  if (cuenta.kind !== 'pasivo') {
    throw new Error(`La cuenta "${cuenta.nombre}" no es una tarjeta ni una deuda`);
  }
  if (cuenta.currency !== input.deuda.currency) {
    throw new Error(
      `La cuenta es en ${cuenta.currency} y la deuda en ${input.deuda.currency}: moneda distinta`,
    );
  }

  await ensureSystemAccounts(deps.accounts, input.owner);

  // Un pasivo aumenta con crédito: deber 100 es un saldo de -100. Para que la
  // deuda sea la indicada, el saldo tiene que quedar en su negativo.
  const saldo = await deps.accounts.balanceOf(input.accountId);
  const objetivo = -input.deuda.amount;
  const diferencia: Money = { amount: objetivo - saldo.amount, currency: cuenta.currency };
  if (isZero(diferencia)) return null;

  const debiaAntes = -saldo.amount;
  return registerAdjustment(deps, {
    owner: input.owner,
    accountId: input.accountId,
    amount: diferencia,
    motivo: `Deuda de ${cuenta.nombre}: se debía $ ${formatCOP(debiaAntes)}, se debe $ ${formatCOP(input.deuda.amount)}`,
    fecha: input.fecha,
  });
}
