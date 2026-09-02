import { mesAntesDe, mesDe } from '@/domain/ledger/balance-checkpoint';
import type { CheckpointRepository } from '@/domain/ledger/checkpoint-repository';
import { calendarDay } from '@/domain/time/colombia';

export interface RefreshCheckpointsDeps {
  cortes: CheckpointRepository;
  clock: () => string;
}

/**
 * Pone al día los cortes de saldo (ADR 0006).
 *
 * Se llama al arrancar. Es incremental: cada cuenta arranca de su último corte,
 * así que la primera vez cuesta un recorrido del historial y a partir de ahí
 * solo lo que haya pasado desde el mes pasado.
 *
 * **Hasta el mes anterior, nunca el actual.** Un mes a medias no es un corte:
 * cambiaría cada día y habría que reescribirlo, que es exactamente el tipo de
 * caché que acaba mintiendo.
 *
 * Si falla, no pasa nada grave: sin cortes la app calcula igual, solo leyendo
 * más. Por eso el llamador puede tragarse el error —y por eso se registra—.
 */
export function refreshCheckpoints(deps: RefreshCheckpointsDeps): Promise<number> {
  const hoy = calendarDay(deps.clock());
  return deps.cortes.reconstruir(mesAntesDe(mesDe(hoy)), deps.clock());
}
