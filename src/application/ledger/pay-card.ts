import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import { isNegative, isZero, negate, type Money } from '@/domain/money/money';

import { manualTransactionId, type LedgerDeps } from './register-adjustment';

/**
 * Pagar la tarjeta: dinero que se mueve de un activo a un pasivo.
 *
 * **No es un gasto**, y es el error contable más común de las apps de
 * finanzas: contar el pago como gasto hace que comprar mil pesos con la
 * tarjeta y pagarlos cueste dos mil, y que el «mayor gasto del mes» sea
 * siempre pagar la tarjeta. El gasto ocurrió cuando se compró.
 *
 * Dos apuntes y nada más: baja el activo, baja la deuda.
 */
export async function payCard(
  deps: LedgerDeps,
  input: {
    owner: OwnerId;
    /** La cuenta de la que sale la plata. */
    desde: AccountId;
    /** La tarjeta que se paga. */
    tarjeta: AccountId;
    monto: Money;
    fecha?: string;
  },
): Promise<Transaction> {
  if (input.desde === input.tarjeta) {
    throw new Error('No se puede pagar una tarjeta con la misma tarjeta');
  }
  if (isZero(input.monto) || isNegative(input.monto)) {
    throw new Error('El pago tiene que ser positivo');
  }

  const origen = await deps.accounts.findById(input.desde);
  const tarjeta = await deps.accounts.findById(input.tarjeta);
  if (origen === null || origen.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.desde}"`);
  }
  if (tarjeta === null || tarjeta.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.tarjeta}"`);
  }
  if (tarjeta.kind !== 'pasivo') {
    // Pagar algo que no es una deuda no es pagar: es transferir, y para eso
    // hay otro caso de uso. Dejarlo pasar aquí escondería el error.
    throw new Error(`La cuenta "${input.tarjeta}" no es una tarjeta ni una deuda`);
  }
  if (origen.currency !== input.monto.currency || tarjeta.currency !== input.monto.currency) {
    throw new Error('El pago y las cuentas tienen que ser de la misma moneda');
  }

  const tx = createTransaction({
    id: manualTransactionId(deps.ids),
    owner: input.owner,
    fecha: input.fecha ?? deps.clock(),
    descripcion: `Pago de tarjeta ${tarjeta.nombre}`,
    origen: { fuente: 'manual', referencia: null },
    postings: [
      // Sale del activo…
      { accountId: input.desde, amount: negate(input.monto) },
      // …y baja la deuda. Un pasivo aumenta con crédito, así que reducirlo
      // lleva signo positivo: es el mismo signo que un gasto tendría sobre
      // una cuenta de gasto, y por eso conviene mirar el `kind`, no el signo.
      { accountId: input.tarjeta, amount: input.monto },
    ],
  });
  await deps.transactions.save(tx);
  return tx;
}
