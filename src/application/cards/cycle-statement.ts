import { cicloDe, contiene, esPagoDelCiclo, type BillingCycle } from '@/domain/cards/billing-cycle';
import type { CardRepository } from '@/domain/cards/card-repository';
import { isRealAccount } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, OwnerId, TransactionId } from '@/domain/ledger/ids';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';
import { add, isNegative, zero, type Money } from '@/domain/money/money';

export interface CycleStatement {
  ciclo: BillingCycle;
  /** Lo comprado dentro del ciclo. */
  compras: Money;
  /** Lo pagado dentro de la ventana de pago del ciclo, o cero si aún nada. */
  pagos: Money;
  movimientos: TransactionId[];
}

export interface CycleStatementDeps {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  cards: CardRepository;
}

/** Cuántos movimientos se miran de la tarjeta. Un ciclo no tiene mil. */
const VENTANA = 500;

/**
 * El extracto de un ciclo: qué se compró y qué se pagó.
 *
 * Las compras son los apuntes que **aumentan la deuda** —negativos sobre un
 * pasivo—; los pagos, los que la bajan. Mirar el signo y no la descripción es
 * lo que hace que esto no dependa de cómo escriba cada banco.
 */
export async function cycleStatement(
  deps: CycleStatementDeps,
  input: { owner: OwnerId; accountId: AccountId; fecha: string },
): Promise<CycleStatement | null> {
  const tarjeta = await deps.cards.find(input.accountId);
  if (tarjeta === null || tarjeta.owner !== input.owner) return null;

  const cuenta = await deps.accounts.findById(input.accountId);
  if (cuenta === null || !isRealAccount(cuenta.kind)) return null;

  const ciclo = cicloDe(input.fecha, tarjeta.diaDeCorte, tarjeta.diaDePago);
  const pagina = await deps.transactions.list(
    input.owner,
    { accountId: input.accountId },
    { limit: VENTANA },
  );

  let compras = zero(cuenta.currency);
  let pagos = zero(cuenta.currency);
  const movimientos: TransactionId[] = [];

  for (const t of pagina.items) {
    const apunte = t.postings.find((p) => p.accountId === input.accountId);
    if (apunte === undefined) continue;

    if (contiene(ciclo, t.fecha)) {
      // Sobre un pasivo, negativo es más deuda: una compra.
      if (isNegative(apunte.amount)) {
        compras = add(compras, { amount: -apunte.amount.amount, currency: apunte.amount.currency });
        movimientos.push(t.id);
      }
    }
    // Los pagos tienen su propia ventana: van del cierre al día de pago, así
    // que caen fuera del intervalo de compras de este ciclo.
    if (!isNegative(apunte.amount) && esPagoDelCiclo(ciclo, t.fecha)) {
      pagos = add(pagos, apunte.amount);
    }
  }

  return { ciclo, compras, pagos, movimientos };
}
