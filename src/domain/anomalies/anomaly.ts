import type { TransactionId } from '@/domain/ledger/ids';

export type TipoAnomalia = 'monto-inusual' | 'precio-subio' | 'cobro-repetido' | 'comercio-dormido';

export interface Anomaly {
  /**
   * Estable entre corridas. Si cambiara, una anomalía que David descartó
   * volvería a aparecer, y eso enseña a ignorar la pantalla entera.
   */
  id: string;
  tipo: TipoAnomalia;
  transaccion: TransactionId;
  /** Qué pasó, en una frase que se entienda sin contexto. */
  explicacion: string;
  /**
   * Contra qué se midió. Es un campo aparte y no parte del texto **para que
   * exista**: una explicación que no dice contra qué se comparó no explica nada.
   */
  comparadoCon: string;
  /** De 0 a 1. Ordena la lista: lo más seguro primero. */
  confianza: number;
}

export function createAnomaly(input: Anomaly): Anomaly {
  if (input.explicacion.trim().length === 0) {
    throw new Error('Una anomalía sin explicación es ruido: no se puede crear');
  }
  if (input.comparadoCon.trim().length === 0) {
    throw new Error('Una anomalía tiene que decir contra qué se comparó');
  }
  if (input.confianza < 0 || input.confianza > 1) {
    throw new Error('La confianza va de 0 a 1');
  }
  return { ...input };
}

/** El id de una anomalía: su tipo y la transacción. Estable por construcción. */
export function anomalyId(tipo: TipoAnomalia, transaccion: TransactionId): string {
  return `${tipo}:${transaccion}`;
}
