import type { BalanceCheckpoint } from './balance-checkpoint';
import type { AccountId } from './ids';

/**
 * Dónde viven los cortes de saldo.
 *
 * Todo lo que entra aquí es reconstruible desde el ledger. Ninguna operación
 * de este puerto puede cambiar una cifra de la app: solo lo que tarda en salir.
 */
export interface CheckpointRepository {
  /** El corte más reciente de la cuenta cuya frontera no pasa de `hasta`. */
  ultimoAntesDe: (accountId: AccountId, hasta?: string) => Promise<BalanceCheckpoint | null>;
  guardar: (cortes: readonly BalanceCheckpoint[]) => Promise<void>;
  /**
   * Borra los cortes de la cuenta desde un mes en adelante.
   *
   * **Se borran, no se ajustan.** Ajustar un corte es hacer aritmética sobre un
   * caché, y ahí es donde estos diseños empiezan a mentir: basta un ajuste mal
   * hecho para que el saldo quede mal para siempre y sin fallar. Borrar es
   * caro una vez y correcto siempre.
   */
  borrarDesde: (accountId: AccountId, mes: string) => Promise<void>;
  /**
   * Recalcula los cortes que falten, hasta el mes dado inclusive.
   *
   * Es incremental: cada cuenta arranca de su último corte, así que solo se
   * lee lo que ha pasado desde entonces. Devuelve cuántos cortes escribió.
   *
   * **Nunca escribe el mes en curso**: un mes a medias no es un corte, es una
   * foto que envejece mal. Quien la llame decide hasta dónde.
   */
  reconstruir: (hastaMes: string, calculadoEn: string) => Promise<number>;
  /** Todos los cortes de una cuenta, del más viejo al más nuevo. */
  listar: (accountId: AccountId) => Promise<BalanceCheckpoint[]>;
  borrarTodo: () => Promise<void>;
}
