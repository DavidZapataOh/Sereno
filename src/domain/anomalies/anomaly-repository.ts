import type { OwnerId } from '@/domain/ledger/ids';

/**
 * Qué anomalías descartó David.
 *
 * **Solo lo descartado se guarda.** Las anomalías se derivan en cada consulta;
 * lo que no se puede derivar es que él dijo «esto está bien». Sin esto, la
 * misma alerta volvería cada vez y la pantalla dejaría de leerse.
 */
export interface AnomalyRepository {
  descartar: (owner: OwnerId, id: string, cuando: string) => Promise<void>;
  descartadas: (owner: OwnerId) => Promise<Set<string>>;
}
