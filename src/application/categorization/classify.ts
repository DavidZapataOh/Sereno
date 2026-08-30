import { toCategory } from '@/domain/categorization/category';
import type { ClassificationSource } from '@/domain/categorization/classification';
import { featuresOf, predict, shouldApply } from '@/domain/categorization/naive-bayes';
import { categoryAccountId } from '@/domain/categorization/taxonomy';
import type { Account } from '@/domain/ledger/account';
import type { AccountId, OwnerId, TransactionId } from '@/domain/ledger/ids';
import { isUnclassified } from '@/domain/ledger/system-accounts';
import type { Transaction } from '@/domain/ledger/transaction';

import { factsOf, type TransactionFacts } from './facts';
import { ruleFor } from './rules';
import { currentCategoryOf, setCategory } from './set-category';
import type { CategorizationDeps } from './types';

export interface Verdict {
  categoria: AccountId;
  origen: Exclude<ClassificationSource, 'manual'>;
  reglaId: string | null;
  confianza: number;
}

/** Lo que dice el catálogo cuando ni regla ni aprendizaje deciden. */
const CATALOG_CONFIDENCE = 80;

async function cuentasDe(
  deps: Pick<CategorizationDeps, 'accounts'>,
  owner: OwnerId,
): Promise<Map<AccountId, Account>> {
  const cuentas = await deps.accounts.listByOwner(owner, { incluirArchivadas: true });
  return new Map(cuentas.map((c) => [c.id, c]));
}

async function categoriaUtilizable(
  deps: Pick<CategorizationDeps, 'accounts' | 'categories'>,
  owner: OwnerId,
  id: AccountId,
): Promise<boolean> {
  const [cuenta, detalle] = await Promise.all([
    deps.accounts.findById(id),
    deps.categories.findDetails(id),
  ]);
  if (cuenta === null || detalle === null || cuenta.owner !== owner) return false;
  return toCategory(cuenta, detalle).archivedAt === null;
}

/**
 * Regla del usuario > lo aprendido de sus correcciones > catálogo > nada.
 *
 * Lo aprendido va antes que el catálogo porque si el usuario dijo dos veces
 * que Éxito es «Hogar», el catálogo no tiene voto. Y nada antes que un error
 * seguro: por debajo del umbral se deja sin clasificar y se pide revisión.
 */
export async function decide(
  deps: CategorizationDeps,
  input: { owner: OwnerId; facts: TransactionFacts },
): Promise<Verdict | null> {
  const { owner, facts } = input;
  if (facts.sentido === null) return null;

  const regla = await ruleFor(deps, { owner, facts });
  if (regla !== null && (await categoriaUtilizable(deps, owner, regla.categoria))) {
    return { categoria: regla.categoria, origen: 'regla', reglaId: regla.id, confianza: 100 };
  }

  const rasgos = featuresOf(facts);
  const [evidencias, totales, vocabulario] = await Promise.all([
    deps.evidence.listByFeatures(owner, rasgos),
    deps.evidence.countByCategory(owner),
    deps.evidence.vocabularySize(owner),
  ]);
  const prediccion = predict(evidencias, rasgos, { totales, vocabulario });
  if (
    prediccion !== null &&
    shouldApply(prediccion) &&
    (await categoriaUtilizable(deps, owner, prediccion.categoria))
  ) {
    return {
      categoria: prediccion.categoria,
      origen: 'aprendida',
      reglaId: null,
      confianza: prediccion.confianza,
    };
  }

  const sugerida = facts.merchant.categoriaSugerida;
  if (sugerida !== null) {
    const id = categoryAccountId(sugerida);
    if (await categoriaUtilizable(deps, owner, id)) {
      return { categoria: id, origen: 'catalogo', reglaId: null, confianza: CATALOG_CONFIDENCE };
    }
  }
  return null;
}

async function aplicar(
  deps: CategorizationDeps,
  owner: OwnerId,
  tx: Transaction,
  cuentas: Map<AccountId, Account>,
): Promise<Verdict | null> {
  const existente = await deps.classifications.findByTransaction(tx.id);
  if (existente?.origen === 'manual') return null;
  const veredicto = await decide(deps, { owner, facts: factsOf(tx, cuentas) });
  if (veredicto === null) return null;
  if (currentCategoryOf(tx) !== veredicto.categoria || existente?.origen !== veredicto.origen) {
    await setCategory(deps, {
      owner,
      transactionId: tx.id,
      categoria: veredicto.categoria,
      origen: veredicto.origen,
      reglaId: veredicto.reglaId ?? undefined,
      confianza: veredicto.confianza,
    });
  }
  return veredicto;
}

/** Decide y aplica para una transacción. No toca lo clasificado a mano. */
export async function classifyTransaction(
  deps: CategorizationDeps,
  input: { owner: OwnerId; transactionId: TransactionId },
): Promise<Verdict | null> {
  const tx = await deps.transactions.findById(input.transactionId);
  if (tx === null || tx.owner !== input.owner) return null;
  return aplicar(deps, input.owner, tx, await cuentasDe(deps, input.owner));
}

/** Lo que sigue contra «sin clasificar»: clasifica lo que puede y cuenta el resto. */
export async function classifyUnclassified(
  deps: CategorizationDeps,
  input: { owner: OwnerId },
): Promise<{ clasificadas: number; porRevisar: number }> {
  const cuentas = await cuentasDe(deps, input.owner);
  let clasificadas = 0;
  let porRevisar = 0;
  let cursor: string | undefined;
  do {
    const pagina = await deps.transactions.list(input.owner, undefined, { limit: 200, cursor });
    for (const tx of pagina.items) {
      if (!tx.postings.some((p) => isUnclassified(p.accountId))) continue;
      if (factsOf(tx, cuentas).sentido === null) continue;
      const v = await aplicar(deps, input.owner, tx, cuentas);
      if (v === null) porRevisar += 1;
      else clasificadas += 1;
    }
    cursor = pagina.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return { clasificadas, porRevisar };
}

/**
 * Aprende de una decisión del usuario.
 *
 * Solo las decisiones manuales suman evidencia, así que solo una decisión
 * manual anterior tiene algo que restar: si el usuario cambia de opinión, su
 * voto anterior se retira. Una clasificación aprendida o de catálogo nunca
 * sumó nada; corregirla no resta.
 */
export async function learnFrom(
  deps: CategorizationDeps,
  input: {
    owner: OwnerId;
    tx: Transaction;
    categoria: AccountId;
    anterior: { categoria: AccountId; origen: ClassificationSource } | null;
  },
): Promise<void> {
  const cuentas = await cuentasDe(deps, input.owner);
  const rasgos = featuresOf(factsOf(input.tx, cuentas));
  if (input.anterior?.origen === 'manual' && input.anterior.categoria !== input.categoria) {
    await deps.evidence.add(input.owner, rasgos, input.anterior.categoria, -1);
  }
  await deps.evidence.add(input.owner, rasgos, input.categoria, 1);
}

/** Lo que llama la interfaz cuando el usuario elige una categoría. */
export async function correctCategory(
  deps: CategorizationDeps,
  input: { owner: OwnerId; transactionId: TransactionId; categoria: AccountId },
): Promise<{ antes: AccountId | null }> {
  const tx = await deps.transactions.findById(input.transactionId);
  if (tx === null || tx.owner !== input.owner) {
    throw new Error(`No existe la transacción "${input.transactionId}"`);
  }
  const previa = await deps.classifications.findByTransaction(tx.id);
  const { antes } = await setCategory(deps, {
    owner: input.owner,
    transactionId: tx.id,
    categoria: input.categoria,
    origen: 'manual',
  });
  await learnFrom(deps, {
    owner: input.owner,
    tx,
    categoria: input.categoria,
    anterior: previa === null ? null : { categoria: previa.categoria, origen: previa.origen },
  });
  return { antes };
}
