import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { isNegative, isZero, subtract, type Money } from '@/domain/money/money';

export type Verdict = 'cuadra' | 'gasto-no-capturado' | 'ingreso-no-capturado';

export interface Reconciliation {
  id: string;
  owner: OwnerId;
  accountId: AccountId;
  /** Instante al que se compara. El saldo calculado incluye lo asentado hasta aquí. */
  fecha: string;
  saldoReal: Money;
  saldoCalculado: Money;
  /** Real menos calculado. Negativa: salió dinero que no entró al ledger. */
  diferencia: Money;
  veredicto: Verdict;
  fuente: string;
  /** Qué cuenta del banco se usó, para auditar: «Ahorros ****8901». */
  detalle: string;
  creadoEn: string;
}

/**
 * Compara lo que el banco declara con lo que el ledger calcula.
 *
 * No corrige nada: la diferencia se expone tal cual (principio 5). El ajuste
 * que la cierra es una transacción explícita, con motivo, del plan 05.
 */
export function reconcile(input: { saldoReal: Money; saldoCalculado: Money }): {
  diferencia: Money;
  veredicto: Verdict;
} {
  const diferencia = subtract(input.saldoReal, input.saldoCalculado);
  if (isZero(diferencia)) return { diferencia, veredicto: 'cuadra' };
  return {
    diferencia,
    veredicto: isNegative(diferencia) ? 'gasto-no-capturado' : 'ingreso-no-capturado',
  };
}
