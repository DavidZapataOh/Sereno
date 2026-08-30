import { createAccount } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import {
  sourceAccountId,
  SYSTEM_ACCOUNT_KEYS,
  systemAccount,
} from '@/domain/ledger/system-accounts';

/**
 * Garantiza que existan las cuentas del sistema.
 *
 * Solo crea las que faltan: si el usuario renombró «Efectivo» a «Billetera»,
 * eso se respeta. Se llama antes de cualquier ingesta; es barato y evita que
 * la primera transacción de la vida de la app falle por clave foránea.
 */
export async function ensureSystemAccounts(
  accounts: AccountRepository,
  owner: OwnerId,
): Promise<void> {
  for (const key of SYSTEM_ACCOUNT_KEYS) {
    const cuenta = systemAccount(owner, key);
    if ((await accounts.findById(cuenta.id)) === null) await accounts.save(cuenta);
  }
}

interface SourceSpec {
  fuente: string;
  nombre: string;
  numero?: string;
}

/** La cuenta de activo de una fuente externa, creándola la primera vez. */
export async function ensureSourceAccount(
  accounts: AccountRepository,
  owner: OwnerId,
  spec: SourceSpec,
): Promise<AccountId> {
  const id = sourceAccountId(spec.fuente, spec.numero);
  if ((await accounts.findById(id)) === null) {
    await accounts.save(
      createAccount({ id, owner, kind: 'activo', nombre: spec.nombre, currency: 'COP' }),
    );
  }
  return id;
}
