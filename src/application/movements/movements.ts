import {
  toCategory,
  type Category,
  type CategoryDetails,
  type CategoryRepository,
} from '@/domain/categorization/category';
import type {
  Classification,
  ClassificationRepository,
} from '@/domain/categorization/classification';
import { merchantOf, type Merchant } from '@/domain/categorization/merchant';
import { isCategoryAccount } from '@/domain/categorization/taxonomy';
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
  categories: CategoryRepository;
  classifications: ClassificationRepository;
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
  /** Nombre legible y clave de agrupación, derivados de la descripción (sprint 05). */
  comercio: Merchant;
  /** La categoría vigente, si la contrapartida es una cuenta de categoría. */
  categoria: Category | null;
  /** Quién la decidió y con qué seguridad; `null` si está sin clasificar. */
  clasificacion: Classification | null;
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
export function toMovementView(
  t: Transaction,
  cuentas: Map<AccountId, Account>,
  detalles: Map<AccountId, CategoryDetails> = new Map(),
  clasificacion: Classification | null = null,
): MovementView {
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
  const apunteCategoria = t.postings.find((p) => isCategoryAccount(p.accountId));
  const cuentaCategoria =
    apunteCategoria === undefined ? undefined : cuentas.get(apunteCategoria.accountId);
  const detalle =
    apunteCategoria === undefined ? undefined : detalles.get(apunteCategoria.accountId);
  const categoria =
    cuentaCategoria !== undefined && detalle !== undefined
      ? toCategory(cuentaCategoria, detalle)
      : null;

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
    comercio: merchantOf(t.descripcion),
    categoria,
    clasificacion,
  };
}

async function detallesDe(
  deps: MovementsDeps,
  owner: OwnerId,
): Promise<Map<AccountId, CategoryDetails>> {
  const detalles = await deps.categories.listDetails(owner);
  return new Map(detalles.map((d) => [d.accountId, d]));
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
  const [cuentas, detalles] = await Promise.all([
    cuentasDe(deps, pagina.items),
    detallesDe(deps, input.owner),
  ]);
  const items: MovementView[] = [];
  for (const t of pagina.items) {
    const clasificacion = await deps.classifications.findByTransaction(t.id);
    items.push(toMovementView(t, cuentas, detalles, clasificacion));
  }
  return { items, nextCursor: pagina.nextCursor };
}

export async function getMovement(
  deps: MovementsDeps,
  input: { owner: OwnerId; id: TransactionId },
): Promise<MovementDetail | null> {
  const transaccion = await deps.transactions.findById(input.id);
  if (transaccion === null || transaccion.owner !== input.owner) return null;
  const [cuentas, detalles, clasificacion, observaciones, transferencia] = await Promise.all([
    cuentasDe(deps, [transaccion]),
    detallesDe(deps, input.owner),
    deps.classifications.findByTransaction(transaccion.id),
    deps.ingest.listObservations(transaccion.id),
    deps.transfers.findByTransaction(transaccion.id),
  ]);
  return {
    vista: toMovementView(transaccion, cuentas, detalles, clasificacion),
    transaccion,
    cuentas,
    observaciones,
    transferencia,
  };
}
