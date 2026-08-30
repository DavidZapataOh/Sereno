import { cleanDescription, merchantOf, type Merchant } from '@/domain/categorization/merchant';
import { counterpartOf } from '@/domain/categorization/recategorize';
import type { RuleFacts } from '@/domain/categorization/rule';
import type { Account } from '@/domain/ledger/account';
import type { AccountId } from '@/domain/ledger/ids';
import type { Transaction } from '@/domain/ledger/transaction';
import { absolute, isNegative, money, type Money } from '@/domain/money/money';

export interface TransactionFacts extends RuleFacts {
  merchant: Merchant;
  monto: Money;
  /** `null`: no hay contrapartida clasificable (transferencia, reparto). */
  sentido: 'gasto' | 'ingreso' | null;
}

/** Lo que reglas y clasificador leen de una transacción. */
export function factsOf(tx: Transaction, cuentas: Map<AccountId, Account>): TransactionFacts {
  const merchant = merchantOf(tx.descripcion);
  const contrapartida = counterpartOf(tx, cuentas);
  const real =
    contrapartida === null ? null : (tx.postings.find((p) => p !== contrapartida) ?? null);
  const monto = real?.amount ?? tx.postings[0]?.amount ?? money(0, 'COP');
  return {
    merchant,
    comercio: merchant.clave,
    descripcion: cleanDescription(tx.descripcion),
    monto: absolute(monto),
    sentido: real === null ? null : isNegative(real.amount) ? 'gasto' : 'ingreso',
  };
}
