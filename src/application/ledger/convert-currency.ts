import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { conversionAccount, conversionAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import { formatAmount } from '@/domain/money/format';
import type { CurrencyCode } from '@/domain/money/currency';
import { isNegative, isZero, negate, type Money } from '@/domain/money/money';

import { manualTransactionId, type LedgerDeps } from './register-adjustment';

export interface ConversionInput {
  owner: OwnerId;
  /** La cuenta de la que sale el dinero, en la moneda que se entrega. */
  desde: AccountId;
  /** La cuenta a la que llega, en la moneda que se recibe. */
  hacia: AccountId;
  entrega: Money;
  recibe: Money;
  fecha?: string;
}

/**
 * Cambiar una moneda por otra.
 *
 * **No es una transacción, son dos.** Cien USDC no cuadran con cuatrocientos
 * mil pesos: son dos hechos distintos unidos por una tasa, y la tasa cambia.
 * Forzarlos en una sola transacción obligaría a elegir una tasa al asentar y a
 * reescribirla cada vez que se moviera.
 *
 * Las dos patas se encuentran en el puente de conversiones, que es **una cuenta
 * por moneda** porque una cuenta tiene una sola. Los dos saldos juntos son la
 * posición de cambio: valorados en pesos dicen cuánto se ganó o se perdió. Y
 * como son de patrimonio, no inflan el patrimonio neto —que suma activos y
 * pasivos—: cambiar de moneda no es ganar ni perder dinero.
 */
export async function convertCurrency(
  deps: LedgerDeps,
  input: ConversionInput,
): Promise<{ salida: Transaction; entrada: Transaction }> {
  if (input.entrega.currency === input.recibe.currency) {
    throw new Error('Las dos monedas son la misma: eso es una transferencia, no una conversión');
  }
  for (const monto of [input.entrega, input.recibe]) {
    if (isZero(monto) || isNegative(monto)) {
      throw new Error('Los dos montos de una conversión tienen que ser positivos');
    }
  }

  const origen = await deps.accounts.findById(input.desde);
  const destino = await deps.accounts.findById(input.hacia);
  if (origen === null || origen.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.desde}"`);
  }
  if (destino === null || destino.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.hacia}"`);
  }
  // Meter USDC en una cuenta de pesos es la forma más silenciosa de corromper
  // un ledger: cuadra y no significa nada.
  if (origen.currency !== input.entrega.currency) {
    throw new Error(
      `La cuenta "${origen.nombre}" es en ${origen.currency} y se entregan ${input.entrega.currency}: moneda distinta`,
    );
  }
  if (destino.currency !== input.recibe.currency) {
    throw new Error(
      `La cuenta "${destino.nombre}" es en ${destino.currency} y se reciben ${input.recibe.currency}: moneda distinta`,
    );
  }

  // Un puente por moneda: una cuenta tiene una sola moneda, así que un único
  // puente con pesos y USDC dentro no se podría consultar. Se crean al vuelo
  // porque las monedas que se usen no se saben de antemano.
  const puenteEntrega = conversionAccountId(input.entrega.currency);
  const puenteRecibe = conversionAccountId(input.recibe.currency);
  await asegurarPuente(deps, input.owner, input.entrega.currency);
  await asegurarPuente(deps, input.owner, input.recibe.currency);
  const fecha = input.fecha ?? deps.clock();
  // La tasa implícita queda escrita: dentro de seis meses «conversión» no dice
  // nada, y «400.000 COP por 100 USDC» sí.
  const descripcion = `Cambio de ${formatAmount(input.entrega.amount, input.entrega.currency)} ${input.entrega.currency} por ${formatAmount(input.recibe.amount, input.recibe.currency)} ${input.recibe.currency}`;

  const salida = createTransaction({
    id: manualTransactionId(deps.ids),
    owner: input.owner,
    fecha,
    descripcion,
    origen: { fuente: 'manual', referencia: null },
    postings: [
      { accountId: input.desde, amount: negate(input.entrega) },
      { accountId: puenteEntrega, amount: input.entrega },
    ],
  });
  const entrada = createTransaction({
    id: manualTransactionId(deps.ids),
    owner: input.owner,
    fecha,
    descripcion,
    origen: { fuente: 'manual', referencia: null },
    postings: [
      { accountId: puenteRecibe, amount: negate(input.recibe) },
      { accountId: input.hacia, amount: input.recibe },
    ],
  });

  // Las dos o ninguna: una pata suelta deja el puente descuadrado, y un puente
  // descuadrado es una posición de cambio que no existió.
  await deps.transactions.save(salida);
  try {
    await deps.transactions.save(entrada);
  } catch (error) {
    await deps.transactions.delete(salida.id);
    throw error;
  }

  return { salida, entrada };
}

/** El puente de una moneda existe o se crea. Es idempotente. */
async function asegurarPuente(
  deps: LedgerDeps,
  owner: OwnerId,
  currency: CurrencyCode,
): Promise<void> {
  const id = conversionAccountId(currency);
  if ((await deps.accounts.findById(id)) === null) {
    await deps.accounts.save(conversionAccount(owner, currency));
  }
}
