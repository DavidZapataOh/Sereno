import type {
  BatchChange,
  ClassificationBatch,
  ClassificationSnapshot,
} from '@/domain/categorization/batch';
import type { Merchant } from '@/domain/categorization/merchant';
import { featuresOf } from '@/domain/categorization/naive-bayes';
import type { Account } from '@/domain/ledger/account';
import type { AccountId, OwnerId, TransactionId } from '@/domain/ledger/ids';
import { isUnclassified } from '@/domain/ledger/system-accounts';
import type { Transaction } from '@/domain/ledger/transaction';
import { add, zero, type Money } from '@/domain/money/money';

import { correctCategory, decide } from './classify';
import { factsOf } from './facts';
import { createRule, deleteRule } from './rules';
import { setCategory, unsetCategory } from './set-category';
import type { CategorizationDeps } from './types';

/** Por debajo de esta confianza, lo clasificado solo también pide revisión. */
const REVIEW_BELOW = 80;

export interface PendingGroup {
  comercio: Merchant;
  transacciones: {
    id: TransactionId;
    fecha: string;
    descripcion: string;
    monto: Money;
    sugerida: AccountId | null;
  }[];
  total: Money;
  /** Lo que el clasificador propondría, para preseleccionarlo. */
  sugerida: AccountId | null;
}

async function cuentasDe(
  deps: Pick<CategorizationDeps, 'accounts'>,
  owner: OwnerId,
): Promise<Map<AccountId, Account>> {
  const cuentas = await deps.accounts.listByOwner(owner, { incluirArchivadas: true });
  return new Map(cuentas.map((c) => [c.id, c]));
}

async function* historia(
  deps: Pick<CategorizationDeps, 'transactions'>,
  owner: OwnerId,
): AsyncGenerator<Transaction> {
  let cursor: string | undefined;
  do {
    const pagina = await deps.transactions.list(owner, undefined, { limit: 200, cursor });
    for (const t of pagina.items) yield t;
    cursor = pagina.nextCursor ?? undefined;
  } while (cursor !== undefined);
}

/**
 * Lo que pide una decisión: sin clasificar, o clasificado solo con poca
 * seguridad. Agrupado por comercio, de más movimientos a menos: una decisión
 * por comercio, no por movimiento.
 */
export async function listPending(
  deps: CategorizationDeps,
  input: { owner: OwnerId },
): Promise<PendingGroup[]> {
  const cuentas = await cuentasDe(deps, input.owner);
  const grupos = new Map<string, PendingGroup>();
  for await (const tx of historia(deps, input.owner)) {
    const hechos = factsOf(tx, cuentas);
    if (hechos.sentido === null) continue;
    const sinClasificar = tx.postings.some((p) => isUnclassified(p.accountId));
    if (!sinClasificar) {
      const c = await deps.classifications.findByTransaction(tx.id);
      if (c === null || c.origen === 'manual' || c.origen === 'regla') continue;
      if (c.confianza >= REVIEW_BELOW) continue;
    }
    const veredicto = await decide(deps, { owner: input.owner, facts: hechos });
    const sugerida = veredicto?.categoria ?? null;
    const grupo = grupos.get(hechos.comercio) ?? {
      comercio: hechos.merchant,
      transacciones: [],
      total: zero('COP'),
      sugerida,
    };
    grupo.transacciones.push({
      id: tx.id,
      fecha: tx.fecha,
      descripcion: tx.descripcion,
      monto: hechos.monto,
      sugerida,
    });
    grupo.total = add(grupo.total, hechos.monto);
    grupos.set(hechos.comercio, grupo);
  }
  return [...grupos.values()].sort((a, b) => {
    const porCantidad = b.transacciones.length - a.transacciones.length;
    if (porCantidad !== 0) return porCantidad;
    return a.comercio.nombre.localeCompare(b.comercio.nombre);
  });
}

/**
 * Clasifica a mano un grupo de transacciones en un lote: cada una aprende, y
 * con `siempre` se crea la regla «comercio es X → categoría», que además
 * aplica a la historia.
 */
export async function categorizeGroup(
  deps: CategorizationDeps,
  input: {
    owner: OwnerId;
    transactionIds: TransactionId[];
    categoria: AccountId;
    siempre?: boolean;
  },
): Promise<ClassificationBatch> {
  if (input.transactionIds.length === 0) throw new Error('El lote está vacío');
  const cuentas = await cuentasDe(deps, input.owner);
  const cambios: BatchChange[] = [];
  let comercio = '';
  for (const id of input.transactionIds) {
    const tx = await deps.transactions.findById(id);
    if (tx === null || tx.owner !== input.owner)
      throw new Error(`No existe la transacción "${id}"`);
    if (comercio === '') comercio = factsOf(tx, cuentas).comercio;
    const previa = await deps.classifications.findByTransaction(id);
    const antes: ClassificationSnapshot | null =
      previa === null
        ? null
        : {
            categoria: previa.categoria,
            origen: previa.origen,
            reglaId: previa.reglaId,
            confianza: previa.confianza,
          };
    await correctCategory(deps, {
      owner: input.owner,
      transactionId: id,
      categoria: input.categoria,
    });
    cambios.push({ transactionId: id, antes, despues: input.categoria });
  }
  let reglaId: string | null = null;
  if (input.siempre === true) {
    const { rule } = await createRule(deps, {
      owner: input.owner,
      draft: { campo: 'comercio', operador: 'es', valor: comercio, categoria: input.categoria },
    });
    reglaId = rule.id;
  }
  const lote: ClassificationBatch = {
    id: deps.ids.next(),
    owner: input.owner,
    comercio,
    cambios,
    reglaId,
    creadoEn: deps.clock(),
    deshechoEn: null,
  };
  await deps.batches.save(lote);
  return lote;
}

/** Deja todo como estaba: categorías, regla y evidencia. */
export async function undoBatch(
  deps: CategorizationDeps,
  input: { owner: OwnerId; batchId: string },
): Promise<void> {
  const lote = await deps.batches.findById(input.batchId);
  if (lote === null || lote.owner !== input.owner) {
    throw new Error(`No existe el lote "${input.batchId}"`);
  }
  if (lote.deshechoEn !== null) throw new Error('Este lote ya se había deshecho');
  const cuentas = await cuentasDe(deps, input.owner);

  if (lote.reglaId !== null) {
    // Lo que la regla clasificó por su cuenta vuelve a sin clasificar.
    const porRegla = await deps.classifications.listByOwner(input.owner, { origen: 'regla' });
    for (const c of porRegla) {
      if (c.reglaId !== lote.reglaId) continue;
      if (lote.cambios.some((x) => x.transactionId === c.transactionId)) continue;
      await unsetCategory(deps, { owner: input.owner, transactionId: c.transactionId });
    }
    await deleteRule(deps, { owner: input.owner, id: lote.reglaId });
  }

  for (const cambio of [...lote.cambios].reverse()) {
    const tx = await deps.transactions.findById(cambio.transactionId);
    if (tx === null) continue;
    // Lo que aprendió de esta decisión se olvida.
    await deps.evidence.add(input.owner, featuresOf(factsOf(tx, cuentas)), cambio.despues, -1);
    if (cambio.antes === null) {
      await unsetCategory(deps, { owner: input.owner, transactionId: cambio.transactionId });
    } else {
      await setCategory(deps, {
        owner: input.owner,
        transactionId: cambio.transactionId,
        categoria: cambio.antes.categoria,
        origen: cambio.antes.origen,
        reglaId: cambio.antes.reglaId ?? undefined,
        confianza: cambio.antes.confianza,
      });
    }
  }
  await deps.batches.save({ ...lote, deshechoEn: deps.clock() });
}

export function lastBatch(
  deps: Pick<CategorizationDeps, 'batches'>,
  owner: OwnerId,
): Promise<ClassificationBatch | null> {
  return deps.batches.findLatest(owner);
}
