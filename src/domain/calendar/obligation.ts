import type { AccountId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';
import { calendarDay } from '@/domain/time/colombia';

/** De dónde sale la obligación. Las tres fuentes que ya existen. */
export type OrigenObligacion = 'tarjeta' | 'suscripcion' | 'cuota';

export type EstadoObligacion = 'pendiente' | 'pagada' | 'vencida';

export interface Obligation {
  /** Estable entre corridas: la pantalla y los avisos lo usan como clave. */
  id: string;
  origen: OrigenObligacion;
  nombre: string;
  /**
   * `null` cuando todavía no se sabe. El de una tarjeta no se conoce hasta que
   * cierra el ciclo, y poner un estimado sería inventar una cifra que quien la
   * lee tomaría por buena.
   */
  monto: Money | null;
  /** Día de vencimiento, `AAAA-MM-DD`. */
  vence: string;
  estado: EstadoObligacion;
  /**
   * La cuenta que se va a mover. `null` en una suscripción: se cobra donde
   * esté la tarjeta ese mes, y eso no se puede saber antes de que llegue el
   * cobro. Inventar una sería señalar una cuenta que quizá no se toca.
   */
  accountId: AccountId | null;
}

/**
 * En qué estado está una obligación.
 *
 * El día de vencimiento **sigue siendo pendiente hasta que termina**: decir
 * «vencida» a las ocho de la mañana del día de pago es falso, y una app que
 * avisa en falso deja de leerse.
 *
 * La comparación es por día en hora de Colombia. Por instante UTC, una
 * obligación vencería un día antes de tiempo cada noche a partir de las siete.
 */
export function estadoDe(vence: string, pagadaEn: string | null, ahora: string): EstadoObligacion {
  if (pagadaEn !== null) return 'pagada';
  return vence < calendarDay(ahora) ? 'vencida' : 'pendiente';
}
