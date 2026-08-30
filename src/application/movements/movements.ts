import type { IngestRepository } from '@/domain/ingest/ingest-repository';
import type { Observation } from '@/domain/ingest/observation';
import type { TransferRecord } from '@/domain/ingest/transfer-record';
import type { TransferRepository } from '@/domain/ingest/transfer-repository';
import { isRealAccount, type Account } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, OwnerId, TransactionId } from '@/domain/ledger/ids';
import { isUnclassified } from '@/domain/ledger/system-accounts';
import type { Transaction } from '@/domain/ledger/transaction';
import type { Page, TransactionRepository } from '@/domain/ledger/transaction-repository';
import type { MoneyDirection } from '@/domain/money/format';
import { absolute, isNegative, type Money } from '@/domain/money/money';

export interface MovementsDeps {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  ingest: IngestRepository;
  transfers: TransferRepository;
}

export interface MovementView {
  id: TransactionId;
  fecha: string;
  descripcion: string;
  /** Siempre positivo; la dirección va aparte. */
  monto: Money;
  direction: MoneyDirection;
  /** La cuenta desde la que se mira: en una transferencia, la de salida. */
  cuenta: Account;
  contraparte: Account | null;
  esTransferencia: boolean;
  sinClasificar: boolean;
  fuente: string;
}

export interface MovementDetail {
  vista: MovementView;
  transaccion: Transaction;
  cuentas: Map<AccountId, Account>;
  observaciones: Observation[];
  transferencia: TransferRecord | null;
}

/**
 * Vista de una transacción desde el punto de vista del usuario.
 *
 * El apunte «principal» es el de la cuenta real; en una transferencia hay dos
 * y manda el negativo (la salida). La dirección es neutra si los dos apuntes
 * son de cuentas reales: el dinero no entró ni salió del patrimonio.
 */
export function toMovementView(t: Transaction, cuentas: Map<AccountId, Account>): MovementView {
  const conCuenta = t.postings.map((p) => ({
    posting: p,
    account: cuentas.get(p.accountId) ?? null,
  }));
  const reales = conCuenta.filter((x) => x.account !== null && isRealAccount(x.account.kind));
  const esTransferencia = t.postings.length === 2 && reales.length === 2;

  const ordenadas = [...reales].sort(
    (a, b) => (isNegative(a.posting.amount) ? 0 : 1) - (isNegative(b.posting.amount) ? 0 : 1),
  );
  const principal = ordenadas[0] ?? conCuenta[0];
  if (principal === undefined || principal.account === null) {
    throw new Error(`La transacción "${t.id}" no tiene ninguna cuenta conocida`);
  }
  const otro = conCuenta.find((x) => x.posting !== principal.posting) ?? null;

  return {
    id: t.id,
    fecha: t.fecha,
    descripcion: t.descripcion,
    monto: absolute(principal.posting.amount),
    direction: esTransferencia ? 'neutro' : isNegative(principal.posting.amount) ? 'sale' : 'entra',
    cuenta: principal.account,
    contraparte: t.postings.length === 2 ? (otro?.account ?? null) : null,
    esTransferencia,
    sinClasificar: t.postings.some((p) => isUnclassified(p.accountId)),
    fuente: t.origen.fuente,
  };
}

async function cuentasDe(
  deps: MovementsDeps,
  transacciones: Transaction[],
): Promise<Map<AccountId, Account>> {
  const ids = new Set(transacciones.flatMap((t) => t.postings.map((p) => p.accountId)));
  const mapa = new Map<AccountId, Account>();
  for (const id of ids) {
    const cuenta = await deps.accounts.findById(id);
    if (cuenta !== null) mapa.set(id, cuenta);
  }
  return mapa;
}

export async function listMovements(
  deps: MovementsDeps,
  input: { owner: OwnerId; accountId?: AccountId; cursor?: string; limit?: number },
): Promise<Page<MovementView>> {
  const pagina = await deps.transactions.list(
    input.owner,
    input.accountId === undefined ? undefined : { accountId: input.accountId },
    { limit: input.limit ?? 50, cursor: input.cursor },
  );
  const cuentas = await cuentasDe(deps, pagina.items);
  return {
    items: pagina.items.map((t) => toMovementView(t, cuentas)),
    nextCursor: pagina.nextCursor,
  };
}

export async function getMovement(
  deps: MovementsDeps,
  input: { owner: OwnerId; id: TransactionId },
): Promise<MovementDetail | null> {
  const transaccion = await deps.transactions.findById(input.id);
  if (transaccion === null || transaccion.owner !== input.owner) return null;
  const [cuentas, observaciones, transferencia] = await Promise.all([
    cuentasDe(deps, [transaccion]),
    deps.ingest.listObservations(transaccion.id),
    deps.transfers.findByTransaction(transaccion.id),
  ]);
  return {
    vista: toMovementView(transaccion, cuentas),
    transaccion,
    cuentas,
    observaciones,
    transferencia,
  };
}
