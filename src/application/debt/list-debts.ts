import type { CardRepository } from '@/domain/cards/card-repository';
import type { Debt } from '@/domain/debt/debt';
import type { DebtRepository } from '@/domain/debt/debt-repository';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';

export interface ListDebtsDeps {
  accounts: AccountRepository;
  debts: DebtRepository;
  cards: CardRepository;
}

export interface DebtSummary {
  /** Los términos declarados, o `null` si la cuenta es un pasivo sin declarar. */
  terminos: Debt | null;
  accountId: AccountId;
  nombre: string;
  /** Del ledger, siempre. Nunca de algo guardado. */
  saldo: Money;
}

/**
 * Todas las deudas con lo que se debe hoy.
 *
 * **El saldo sale del ledger en cada llamada.** No hay ninguna cifra guardada
 * que pueda quedarse vieja.
 *
 * Lista **todos los pasivos**, tengan términos declarados o no: una tarjeta que
 * llegó por la ingesta y que nadie ha configurado sigue siendo plata que se
 * debe, y esconderla porque le faltan datos sería mentir por omisión.
 */
export async function listDebts(deps: ListDebtsDeps, owner: OwnerId): Promise<DebtSummary[]> {
  const cuentas = (await deps.accounts.listByOwner(owner)).filter((c) => c.kind === 'pasivo');
  const declaradas = new Map((await deps.debts.listar(owner)).map((d) => [d.accountId, d]));

  return Promise.all(
    cuentas.map(async (cuenta) => ({
      terminos: declaradas.get(cuenta.id) ?? null,
      accountId: cuenta.id,
      nombre: declaradas.get(cuenta.id)?.nombre ?? cuenta.nombre,
      saldo: await deps.accounts.balanceOf(cuenta.id),
    })),
  );
}
