import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { subtract, type Money } from '@/domain/money/money';

/**
 * Lo que una tarjeta de crédito tiene y una cuenta cualquiera no.
 *
 * El saldo **no está aquí**: sale del ledger, como el de cualquier cuenta.
 * Guardarlo sería tener dos verdades sobre la misma deuda, y la guardada
 * siempre acaba siendo la vieja.
 */
export interface CreditCard {
  /** La cuenta de pasivo del ledger. Es la clave: una tarjeta es una cuenta. */
  accountId: AccountId;
  owner: OwnerId;
  cupo: Money;
  /** Día del mes en que cierra el ciclo. */
  diaDeCorte: number;
  /** Día del mes en que vence el pago. */
  diaDePago: number;
}

/**
 * Los días 29, 30 y 31 no existen todos los meses.
 *
 * Aceptarlos aquí sería empujar el problema a los ciclos de facturación, donde
 * ya no se sabría si un «31» fue un error de quien lo escribió o una decisión
 * que hay que respetar en febrero.
 */
const DIA_MAXIMO = 28;

function validarDia(dia: number, nombre: string): void {
  if (!Number.isInteger(dia) || dia < 1 || dia > DIA_MAXIMO) {
    throw new Error(`El ${nombre} debe estar entre 1 y ${String(DIA_MAXIMO)}`);
  }
}

export function createCreditCard(input: CreditCard): CreditCard {
  if (input.cupo.amount < 0n) {
    throw new Error('El cupo no puede ser negativo');
  }
  validarDia(input.diaDeCorte, 'día de corte');
  validarDia(input.diaDePago, 'día de pago');
  return { ...input };
}

/**
 * Lo que queda por gastar.
 *
 * Puede salir **negativo**, y así se deja: sobregirarse pasa —una compra en el
 * exterior con la tasa del día, un interés que entra después del corte— y
 * recortarlo a cero escondería justo el momento en que hay que hacer algo.
 */
export function cupoDisponible(card: CreditCard, deuda: Money): Money {
  return subtract(card.cupo, deuda);
}

/**
 * Qué proporción del cupo está usada, entre 0 y 1 —o más, si hay sobregiro—.
 *
 * Con cupo cero devuelve 0 en vez de dividir: una tarjeta sin cupo no está
 * «infinitamente usada», está sin configurar.
 */
export function porcentajeUsado(card: CreditCard, deuda: Money): number {
  if (card.cupo.amount === 0n) return 0;
  if (card.cupo.currency !== deuda.currency) {
    throw new Error('No se puede comparar la deuda con un cupo de otra moneda');
  }
  return Number(deuda.amount) / Number(card.cupo.amount);
}
