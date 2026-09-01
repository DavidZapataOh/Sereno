import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { repartir } from '@/domain/debt/amortization';
import type { DebtRepository } from '@/domain/debt/debt-repository';
import { mensualDe } from '@/domain/debt/rate';
import { createAccount } from '@/domain/ledger/account';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import { absolute, isNegative, isZero, negate, type Money } from '@/domain/money/money';

import { manualTransactionId, type LedgerDeps } from '../ledger/register-adjustment';

export interface PayDebtDeps extends LedgerDeps {
  debts: DebtRepository;
}

/** Donde caen los intereses. La categoría existe desde el sprint 05. */
const INTERESES = categoryAccountId('intereses-de-credito');

export interface PagoRepartido {
  transaction: Transaction;
  intereses: Money;
  capital: Money;
}

/**
 * Pagar una cuota de deuda: parte intereses, parte capital.
 *
 * **Solo los intereses son gasto.** El capital es mover plata de una cuenta a
 * otra: sale del banco y entra a reducir el pasivo, y el patrimonio no se
 * mueve. Contar la cuota entera como gasto haría que pagar deuda pareciera
 * empobrecerse, que es justo lo contrario de lo que pasa —y es el error que
 * `payCard` ya evitaba para las tarjetas desde el sprint 07—.
 *
 * Una deuda **sin tasa** —lo que se le debe a una persona— no genera pata de
 * intereses: es un pago y ya, exactamente como pagar una tarjeta.
 */
export async function payDebt(
  deps: PayDebtDeps,
  input: { owner: OwnerId; deuda: AccountId; desde: AccountId; monto: Money; fecha?: string },
): Promise<PagoRepartido> {
  if (input.desde === input.deuda) {
    throw new Error('No se puede pagar una deuda con ella misma');
  }
  if (isZero(input.monto) || isNegative(input.monto)) {
    throw new Error('El pago tiene que ser positivo');
  }

  const origen = await deps.accounts.findById(input.desde);
  const cuenta = await deps.accounts.findById(input.deuda);
  if (origen === null || origen.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.desde}"`);
  }
  if (cuenta === null || cuenta.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.deuda}"`);
  }
  if (cuenta.kind !== 'pasivo') {
    throw new Error(`La cuenta "${input.deuda}" no es una deuda`);
  }
  if (origen.currency !== input.monto.currency || cuenta.currency !== input.monto.currency) {
    throw new Error('El pago y las cuentas tienen que ser de la misma moneda');
  }

  const deuda = await deps.debts.buscar(input.deuda);
  // Sin términos declarados, o sin tasa, no hay intereses que separar.
  const tasaMensual = deuda === null || deuda.tasa === null ? 0 : mensualDe(deuda.tasa);
  // En el ledger un pasivo tiene saldo negativo: se debe cuando el número es
  // menor que cero. Los intereses se calculan sobre lo que se debe, en
  // positivo, y `repartir` rechaza un negativo para que el error se vea.
  const saldo = absolute(await deps.accounts.balanceOf(input.deuda));
  const { intereses, capital } = repartir(saldo, tasaMensual, input.monto);

  if (!isZero(intereses)) await asegurarCuentaDeIntereses(deps, input.owner);

  const tx = createTransaction({
    id: manualTransactionId(deps.ids),
    owner: input.owner,
    fecha: input.fecha ?? deps.clock(),
    descripcion: `Pago de ${deuda?.nombre ?? cuenta.nombre}`,
    origen: { fuente: 'manual', referencia: null },
    postings: [
      // Sale del activo la cuota entera…
      { accountId: input.desde, amount: negate(input.monto) },
      // …baja la deuda solo el capital…
      { accountId: input.deuda, amount: capital },
      // …y los intereses son gasto. Si son cero, el apunte sobra: un apunte de
      // cero ensucia el movimiento sin decir nada.
      ...(isZero(intereses) ? [] : [{ accountId: INTERESES, amount: intereses }]),
    ],
  });
  await deps.transactions.save(tx);
  return { transaction: tx, intereses, capital };
}

async function asegurarCuentaDeIntereses(deps: PayDebtDeps, owner: OwnerId): Promise<void> {
  if ((await deps.accounts.findById(INTERESES)) !== null) return;
  await deps.accounts.save(
    createAccount({
      id: INTERESES,
      owner,
      kind: 'gasto',
      nombre: 'Intereses de crédito',
      currency: 'COP',
    }),
  );
}
