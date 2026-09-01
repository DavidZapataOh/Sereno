import { createAccount } from '@/domain/ledger/account';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import { isNegative, isZero, negate, type Money } from '@/domain/money/money';
import type { SinkingRepository } from '@/domain/sinking/sinking-repository';

import { manualTransactionId, type LedgerDeps } from '../ledger/register-adjustment';

export interface SetAsideDeps extends LedgerDeps {
  fondos: SinkingRepository;
}

/**
 * Apartar plata para un gasto que llegará.
 *
 * **No es un gasto.** Sale de una cuenta y entra a otra que también es suya, así
 * que el patrimonio no se mueve: por eso el fondo es una cuenta de **activo** y
 * no de patrimonio —las de patrimonio no cuentan en el total, y apartar habría
 * hecho parecer que se pierde plata—.
 *
 * El gasto ocurre cuando llega el cobro, no ahora.
 */
export async function setAside(
  deps: SetAsideDeps,
  input: { owner: OwnerId; fondo: AccountId; desde: AccountId; monto: Money; fecha?: string },
): Promise<Transaction> {
  if (input.desde === input.fondo) throw new Error('No se puede apartar a la misma cuenta');
  if (isZero(input.monto) || isNegative(input.monto)) {
    throw new Error('Lo que se aparta tiene que ser positivo');
  }

  const fondo = await deps.fondos.buscar(input.fondo);
  if (fondo === null || fondo.owner !== input.owner) {
    throw new Error(`"${input.fondo}" no es un fondo`);
  }

  const origen = await deps.accounts.findById(input.desde);
  if (origen === null || origen.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.desde}"`);
  }
  if (
    origen.currency !== input.monto.currency ||
    fondo.objetivo.currency !== input.monto.currency
  ) {
    throw new Error('Lo que se aparta y las cuentas tienen que ser de la misma moneda');
  }

  await asegurarCuentaDelFondo(
    deps,
    input.owner,
    fondo.accountId,
    fondo.nombre,
    input.monto.currency,
  );

  const tx = createTransaction({
    id: manualTransactionId(deps.ids),
    owner: input.owner,
    fecha: input.fecha ?? deps.clock(),
    descripcion: `Apartado para ${fondo.nombre}`,
    origen: { fuente: 'manual', referencia: null },
    postings: [
      { accountId: input.desde, amount: negate(input.monto) },
      { accountId: input.fondo, amount: input.monto },
    ],
  });
  await deps.transactions.save(tx);
  return tx;
}

async function asegurarCuentaDelFondo(
  deps: SetAsideDeps,
  owner: OwnerId,
  id: AccountId,
  nombre: string,
  currency: Money['currency'],
): Promise<void> {
  if ((await deps.accounts.findById(id)) !== null) return;
  await deps.accounts.save(
    // **Activo**, no patrimonio: si no, apartar bajaría el patrimonio neto.
    createAccount({ id, owner, kind: 'activo', nombre, currency }),
  );
}
