import type { CurrencyCode } from '@/domain/money/currency';
import type { AccountId, OwnerId } from './ids';

/**
 * Naturaleza contable de una cuenta.
 *
 * - `activo`: lo que se tiene. Cuentas bancarias, efectivo, cripto.
 * - `pasivo`: lo que se debe. Tarjetas de crédito, préstamos, cuotas.
 * - `ingreso`: de dónde viene el dinero.
 * - `gasto`: adónde se va.
 * - `patrimonio`: saldos de apertura y ajustes.
 */
export type AccountKind = 'activo' | 'pasivo' | 'ingreso' | 'gasto' | 'patrimonio';

export interface Account {
  id: AccountId;
  owner: OwnerId;
  kind: AccountKind;
  nombre: string;
  currency: CurrencyCode;
  /** Fecha ISO en que se archivó, o `null` si sigue activa. */
  archivedAt: string | null;
}

interface CreateAccountInput {
  id: AccountId;
  owner: OwnerId;
  kind: AccountKind;
  nombre: string;
  currency: CurrencyCode;
}

export function createAccount(input: CreateAccountInput): Account {
  if (input.nombre.trim().length === 0) {
    throw new Error('La cuenta necesita un nombre');
  }
  return { ...input, nombre: input.nombre.trim(), archivedAt: null };
}

/**
 * Si la cuenta aumenta con un apunte positivo.
 *
 * Activos y gastos aumentan con débito; pasivos, ingresos y patrimonio, con
 * crédito. Es lo que hace que gastar con una tarjeta —aumentar un pasivo— lleve
 * el signo contrario a gastar con la cuenta de ahorros.
 */
export function increasesWithDebit(kind: AccountKind): boolean {
  return kind === 'activo' || kind === 'gasto';
}

/**
 * Si la cuenta tiene saldo propio.
 *
 * Activos y pasivos lo tienen y componen el patrimonio. Ingresos y gastos miden
 * flujo durante un periodo: preguntar «cuánto hay en Alimentación» no significa
 * nada sin decir entre qué fechas.
 */
export function isRealAccount(kind: AccountKind): boolean {
  return kind === 'activo' || kind === 'pasivo';
}
