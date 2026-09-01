import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { validarDiaDelMes } from '@/domain/time/month-day';

/**
 * De qué es la deuda.
 *
 * Una **tarjeta** es un tipo de deuda, no una cosa aparte: sus términos propios
 * —cupo, día de corte— siguen en `CreditCard` desde el sprint 07, y aquí solo
 * se declara que también es algo que se debe.
 */
export type TipoDeDeuda = 'tarjeta' | 'prestamo' | 'persona';

/**
 * En Colombia las tasas se citan **efectivas anuales** (E.A.) o **mes vencido**
 * (M.V.), y no son lo mismo. «0,024» no significa nada sin saber cuál es: la
 * diferencia entre las dos cambia la cuota lo bastante como para que la
 * simulación mienta. Por eso el tipo va pegado al número, siempre.
 */
export type TipoDeTasa = 'EA' | 'MV';

export interface Tasa {
  valor: number;
  tipo: TipoDeTasa;
}

/**
 * Una tasa por encima de esto no es una deuda: es un dato mal metido. Dejarlo
 * pasar haría que la simulación diera una fecha de salida absurda con toda
 * seriedad, y quien la lee no tiene por qué sospechar del número.
 */
export const TASA_MAXIMA = 1.5;

export interface Debt {
  /** La cuenta de pasivo del ledger. Es la clave: una deuda **es** una cuenta. */
  accountId: AccountId;
  owner: OwnerId;
  tipo: TipoDeDeuda;
  nombre: string;
  /**
   * `null` cuando no aplica —lo que se le debe a una persona—, que **no es lo
   * mismo que cero**: cero es una tasa pactada del 0 %.
   */
  tasa: Tasa | null;
  /** Cuántas cuotas tiene en total. `null` si no tiene plazo. */
  cuotasTotales: number | null;
  /** Día del mes en que vence. `null` si no tiene fecha fija. */
  diaDePago: number | null;
}

/**
 * Una deuda, validada.
 *
 * **El saldo no está aquí.** Sale del ledger, con `balanceOf`. Guardarlo sería
 * tener dos verdades sobre la misma deuda, y la guardada siempre acaba siendo
 * la vieja. Es la misma decisión que tomó el sprint 07 con las tarjetas.
 */
export function createDebt(input: Debt): Debt {
  const nombre = input.nombre.trim();
  if (nombre.length === 0) throw new Error('La deuda necesita un nombre');

  if (input.tasa !== null) {
    if (input.tasa.valor < 0) throw new Error('Una tasa no puede ser negativa');
    if (input.tasa.valor > TASA_MAXIMA) {
      throw new Error(
        `Una tasa de ${String(Math.round(input.tasa.valor * 100))} % es demasiado alta: revísala`,
      );
    }
  }

  if (input.cuotasTotales !== null) {
    if (!Number.isInteger(input.cuotasTotales) || input.cuotasTotales < 1) {
      throw new Error('El plazo son cuotas enteras, y al menos una');
    }
  }

  if (input.diaDePago !== null) validarDiaDelMes(input.diaDePago, 'día de pago');

  return { ...input, nombre };
}
