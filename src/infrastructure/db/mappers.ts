import type { Account, AccountKind } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { getCurrency, type CurrencyCode } from '@/domain/money/currency';
import { money, type Money } from '@/domain/money/money';

const NATURALEZAS: readonly string[] = [
  'activo',
  'pasivo',
  'ingreso',
  'gasto',
  'patrimonio',
] satisfies readonly AccountKind[];

/**
 * Entero con signo y sin adornos.
 *
 * Deliberadamente estricto: ni espacios, ni `+`, ni notación exponencial, ni
 * separadores de miles. `BigInt(' 1 ')` los aceptaría en silencio, y un monto
 * que se cuela mal formado desde una importación es un error que solo aparece
 * meses después, cuando un informe da una cifra que nadie sabe explicar.
 */
const ENTERO = /^-?(0|[1-9]\d*)$/;

/** `bigint` no cabe en un INTEGER de SQLite ni se serializa a JSON: va como texto. */
export function fromMoney(value: Money): string {
  return value.amount.toString();
}

export function toMoney(amount: string, currency: string): Money {
  if (!ENTERO.test(amount)) {
    throw new Error(`Monto inválido en la base: "${amount}"`);
  }
  if (getCurrency(currency) === undefined) {
    throw new Error(`Moneda desconocida en la base: "${currency}"`);
  }
  return money(BigInt(amount), currency as CurrencyCode);
}

export interface AccountRow {
  id: string;
  ownerId: string;
  kind: string;
  nombre: string;
  currency: string;
  archivedAt: string | null;
}

export function fromAccount(account: Account): AccountRow {
  return {
    id: account.id,
    ownerId: account.owner,
    kind: account.kind,
    nombre: account.nombre,
    currency: account.currency,
    archivedAt: account.archivedAt,
  };
}

/**
 * Frontera de confianza: aquí una fila deja de ser texto y pasa a ser dominio.
 *
 * Se valida aunque el esquema declare un `enum`, porque SQLite no aplica los
 * enum de Drizzle: son solo tipos de TypeScript. Una fila escrita por una
 * migración vieja, o a mano, entra igual.
 */
export function toAccount(row: AccountRow): Account {
  if (!NATURALEZAS.includes(row.kind)) {
    throw new Error(`Naturaleza de cuenta desconocida en la base: "${row.kind}"`);
  }
  if (getCurrency(row.currency) === undefined) {
    throw new Error(`Moneda desconocida en la base: "${row.currency}"`);
  }
  return {
    id: accountId(row.id),
    owner: ownerId(row.ownerId),
    kind: row.kind as AccountKind,
    nombre: row.nombre,
    currency: row.currency as CurrencyCode,
    archivedAt: row.archivedAt,
  };
}
