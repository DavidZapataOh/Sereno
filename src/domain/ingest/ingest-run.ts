import type { OwnerId } from '@/domain/ledger/ids';

/**
 * Una corrida de ingesta con sus cuentas.
 *
 * Es lo que la pantalla de conexiones muestra como «última sincronización» y
 * lo que permite responder «¿cuándo entró esto y con qué más?».
 */
export interface IngestRun {
  id: string;
  owner: OwnerId;
  fuente: string;
  iniciadoEn: string;
  terminadoEn: string | null;
  capturas: number;
  extraidas: number;
  nuevas: number;
  duplicadas: number;
  /** Vistas por otra fuente: se sumaron como observación a una transacción existente. */
  fusionadas: number;
  /** No se pudieron convertir (monto cero, fecha inexistente…). Se cuentan, no tumban el lote. */
  omitidas: number;
  transferencias: number;
  error: string | null;
}
