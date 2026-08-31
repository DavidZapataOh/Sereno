import type { TransactionId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';

import type { Cadence } from './cadence';

/** Lo mínimo que la detección necesita de un movimiento. */
export interface CobroCandidato {
  id: TransactionId;
  fecha: string;
  monto: Money;
  /** Clave de agrupación del comercio (sprint 05): «netflix», no «NETFLIX.COM 1234». */
  claveComercio: string;
  nombreComercio: string;
  /** Una transferencia entre cuentas propias no es una suscripción. */
  esTransferencia: boolean;
  /** Solo lo que sale cuenta: un ingreso recurrente es una nómina, no una suscripción. */
  sale: boolean;
}

export interface Subscription {
  /** La clave del comercio: es lo que agrupa. */
  clave: string;
  comercio: string;
  cadencia: Cadence;
  /** El **último** cobro, no el promedio: es lo que van a cobrar la próxima vez. */
  monto: Money;
  ultimoCobro: string;
  /** `null` si lleva tanto sin cobrarse que se da por cancelada. */
  proximoCobro: string | null;
  cobros: TransactionId[];
  /** Todos los montos cobrados, en orden. Lo usa la detección de cambios de precio. */
  historial: Money[];
  confianza: number;
}
