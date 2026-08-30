import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import {
  transactionId,
  type AccountId,
  type OwnerId,
  type TransactionId,
} from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { parsePortalDate } from '@/domain/time/colombia';

import { isCashWithdrawal } from './cash';

/**
 * Id determinista de una transacción ingerida.
 *
 * Es lo que hace idempotente la ingesta sin implementar nada: reprocesar la
 * misma captura produce el mismo id, y `save` reemplaza en vez de duplicar.
 */
export function ingestedTransactionId(fuente: string, referencia: string): TransactionId {
  if (referencia.trim().length === 0) {
    throw new Error('Una transacción ingerida necesita referencia para tener id determinista');
  }
  return transactionId(`${fuente}:${referencia}`);
}

interface Context {
  owner: OwnerId;
  /** La cuenta de activo de la fuente: donde entra o de donde sale el dinero. */
  assetAccountId: AccountId;
  id: TransactionId;
}

const FORMATO_PORTAL = /^\d{4}\/\d{2}\/\d{2}$/;
export const SIN_DESCRIPCION = 'Sin descripción';

/**
 * Convierte lo capturado en una transacción de doble partida.
 *
 * La contraparte es una cuenta «sin clasificar»: el sprint 05 la mueve a la
 * categoría que toque. Un débito (dinero que sale) va del activo a gastos; un
 * crédito (dinero que entra) va de ingresos al activo.
 */
export function toLedgerTransaction(n: NormalizedTransaction, ctx: Context): Transaction {
  if (n.monto === 0) throw new Error('Un monto de cero no es un movimiento');

  const importe = money(n.monto, n.moneda);
  const fecha = FORMATO_PORTAL.test(n.fecha) ? parsePortalDate(n.fecha) : n.fecha;
  // Un banco puede mandar la descripción en blanco. Rechazarlo tumbaría el
  // lote entero por un movimiento; se deja constancia de que no vino nada.
  const descripcion = n.descripcion.trim().length > 0 ? n.descripcion : SIN_DESCRIPCION;

  // Un retiro en cajero es una transferencia al activo Efectivo, no un gasto:
  // el dinero sigue siendo del usuario hasta que lo gaste.
  const contraparte = isCashWithdrawal(n)
    ? systemAccountId('efectivo')
    : n.tipo === 'debito'
      ? systemAccountId('gastos-sin-clasificar')
      : systemAccountId('ingresos-sin-clasificar');
  const signoActivo = n.tipo === 'debito' ? -1n : 1n;

  return createTransaction({
    id: ctx.id,
    owner: ctx.owner,
    fecha,
    descripcion,
    origen: { fuente: n.fuente, referencia: n.referencia },
    postings: [
      { accountId: ctx.assetAccountId, amount: money(signoActivo * importe.amount, n.moneda) },
      { accountId: contraparte, amount: money(-signoActivo * importe.amount, n.moneda) },
    ],
  });
}
