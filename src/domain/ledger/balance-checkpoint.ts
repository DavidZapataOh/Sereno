import type { Money } from '@/domain/money/money';
import { finDeMes, mesAnterior, mesDe } from '@/domain/time/month';

import type { AccountId } from './ids';

/**
 * Cuánto valía una cuenta al cerrar un mes.
 *
 * **Es un caché, no una fuente de verdad** (ADR 0006). El ledger sigue siendo
 * lo único que decide: un corte se puede borrar entero y las cifras de la app
 * no cambian, solo tardan más en salir.
 *
 * Existe porque `balanceOf` sumaba todos los apuntes de la cuenta en cada
 * llamada y la pantalla de inicio lo llama una vez por cuenta: abrir la app
 * costaba el historial entero por cada cuenta, y crecía cada mes sin techo.
 */
export interface BalanceCheckpoint {
  accountId: AccountId;
  /** `AAAA-MM`. El corte vale para el instante en que ese mes termina. */
  mes: string;
  saldo: Money;
  /** Cuándo se calculó. Sirve para saber si un corte es viejo, no para usarlo. */
  calculadoEn: string;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function balanceCheckpoint(input: BalanceCheckpoint): BalanceCheckpoint {
  if (!MES.test(input.mes)) throw new Error(`Un mes se escribe AAAA-MM, no "${input.mes}"`);
  return input;
}

/**
 * El último mes cuyo corte sirve para un saldo pedido «hasta» una fecha.
 *
 * Un corte vale hasta la frontera de su mes. Si `hasta` cae dentro del mes M,
 * el mes M todavía no ha cerrado: hay que quedarse en el anterior. Si `hasta`
 * es exactamente la frontera de M, el corte de M sirve entero.
 */
export function mesUtilizableHasta(hasta: string): string {
  const mes = mesDe(hasta);
  return finDeMes(mes) <= hasta ? mes : mesAnterior(mes);
}
