import { createDebt, type Debt, type Tasa, type TipoDeDeuda } from '@/domain/debt/debt';
import type { DebtRepository } from '@/domain/debt/debt-repository';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';

export interface ConfigureDebtDeps {
  accounts: AccountRepository;
  debts: DebtRepository;
}

/**
 * Declarar los términos de una deuda que ya existe como cuenta.
 *
 * No crea la cuenta: una deuda **es** una cuenta de pasivo, y esas nacen de la
 * ingesta o de declararlas. Aquí solo se le añade lo que el ledger no puede
 * saber —la tasa, el plazo, cuándo vence—, igual que `configureCard` hace con
 * el cupo y el día de corte desde el sprint 07.
 */
export async function configureDebt(
  deps: ConfigureDebtDeps,
  input: {
    owner: OwnerId;
    accountId: AccountId;
    tipo: TipoDeDeuda;
    nombre: string;
    tasa: Tasa | null;
    cuotasTotales: number | null;
    diaDePago: number | null;
  },
): Promise<Debt> {
  const cuenta = await deps.accounts.findById(input.accountId);
  if (cuenta === null || cuenta.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.accountId}"`);
  }
  if (cuenta.kind !== 'pasivo') {
    throw new Error(`La cuenta "${cuenta.nombre}" no es una deuda: es un ${cuenta.kind}`);
  }

  const deuda = createDebt({ ...input });
  await deps.debts.guardar(deuda);
  return deuda;
}
