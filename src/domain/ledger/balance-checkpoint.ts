import type { AccountId } from './ids';
import type { Money } from '@/domain/money/money';

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

/** El mes al que pertenece una fecha del ledger. */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/**
 * La frontera de un corte: el primer instante del mes siguiente.
 *
 * **Se compara como texto**, igual que hace el resto del repositorio con
 * `transactions.fecha`. Es lo que hace que el corte y el cálculo desde cero
 * partan exactamente el mismo conjunto de apuntes: lo que queda por debajo de
 * esta cadena está en el corte, lo que queda por encima se suma aparte. Si se
 * comparara de otra forma —convirtiendo a fecha, por ejemplo— un apunte podría
 * caer en los dos lados o en ninguno, y el saldo mentiría sin fallar.
 */
export function limiteDe(mes: string): string {
  if (!MES.test(mes)) throw new Error(`Un mes se escribe AAAA-MM, no "${mes}"`);
  const [anio = 1970, m = 1] = mes.split('-').map(Number);
  const siguiente =
    m === 12
      ? `${String(anio + 1).padStart(4, '0')}-01`
      : `${String(anio).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}`;
  return `${siguiente}-01T00:00:00.000-05:00`;
}

/** El mes anterior a uno dado. */
export function mesAntesDe(mes: string): string {
  if (!MES.test(mes)) throw new Error(`Un mes se escribe AAAA-MM, no "${mes}"`);
  const [anio = 1970, m = 1] = mes.split('-').map(Number);
  return m === 1
    ? `${String(anio - 1).padStart(4, '0')}-12`
    : `${String(anio).padStart(4, '0')}-${String(m - 1).padStart(2, '0')}`;
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
  return limiteDe(mes) <= hasta ? mes : mesAntesDe(mes);
}

/** El mes siguiente a uno dado. */
export function mesDespuesDe(mes: string): string {
  return limiteDe(mes).slice(0, 7);
}
