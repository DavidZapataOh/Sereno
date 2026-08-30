import {
  createRule as buildRule,
  pickRule,
  specificityOf,
  type Rule,
  type RuleField,
  type RuleOperator,
} from '@/domain/categorization/rule';
import type { Account } from '@/domain/ledger/account';
import type { AccountId, OwnerId, TransactionId } from '@/domain/ledger/ids';
import type { Transaction } from '@/domain/ledger/transaction';

import { factsOf, type TransactionFacts } from './facts';
import { currentCategoryOf, setCategory } from './set-category';
import type { CategorizationDeps } from './types';

export interface RuleDraft {
  campo: RuleField;
  operador: RuleOperator;
  valor: string;
  categoria: AccountId;
}

export interface RulePreview {
  /** Cuántas transacciones históricas cumplen la condición. */
  coinciden: number;
  /** Las que pasarían a otra categoría. */
  cambiarian: number;
  /** Cumplen, pero el usuario las clasificó a mano: se respetan. */
  respetadas: number;
  /** Hasta cinco, para enseñar qué cambiaría. */
  ejemplos: { id: TransactionId; descripcion: string; categoriaActual: AccountId | null }[];
}

async function todasLasCuentas(
  deps: Pick<CategorizationDeps, 'accounts'>,
  owner: OwnerId,
): Promise<Map<AccountId, Account>> {
  const cuentas = await deps.accounts.listByOwner(owner, { incluirArchivadas: true });
  return new Map(cuentas.map((c) => [c.id, c]));
}

/** Recorre toda la historia del propietario, página a página. */
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

function borradorARegla(
  deps: Pick<CategorizationDeps, 'ids' | 'clock'>,
  owner: OwnerId,
  draft: RuleDraft,
  id?: string,
): Rule {
  return buildRule({
    id: id ?? deps.ids.next(),
    owner,
    campo: draft.campo,
    operador: draft.operador,
    valor: draft.valor,
    categoria: draft.categoria,
    creadaEn: deps.clock(),
    activa: true,
  });
}

/**
 * Recorre la historia aplicando (o solo contando) una regla. Lo clasificado
 * a mano se respeta: el usuario lo decidió con nombre y apellido; la regla
 * es general.
 */
async function recorrer(
  deps: CategorizationDeps,
  owner: OwnerId,
  rule: Rule,
  aplicar: boolean,
): Promise<RulePreview> {
  const cuentas = await todasLasCuentas(deps, owner);
  const resultado: RulePreview = { coinciden: 0, cambiarian: 0, respetadas: 0, ejemplos: [] };
  for await (const tx of historia(deps, owner)) {
    const hechos = factsOf(tx, cuentas);
    if (hechos.sentido === null) continue;
    if (pickRule([rule], hechos) === null) continue;
    resultado.coinciden += 1;
    const actual = currentCategoryOf(tx);
    const clasificacion = await deps.classifications.findByTransaction(tx.id);
    if (clasificacion?.origen === 'manual') {
      resultado.respetadas += 1;
      continue;
    }
    if (actual === rule.categoria) continue;
    resultado.cambiarian += 1;
    if (resultado.ejemplos.length < 5) {
      resultado.ejemplos.push({ id: tx.id, descripcion: tx.descripcion, categoriaActual: actual });
    }
    if (aplicar) {
      await setCategory(deps, {
        owner,
        transactionId: tx.id,
        categoria: rule.categoria,
        origen: 'regla',
        reglaId: rule.id,
      });
    }
  }
  return resultado;
}

/** Cuenta y da ejemplos de lo que cambiaría, sin escribir nada. */
export function previewRule(
  deps: CategorizationDeps,
  input: { owner: OwnerId; draft: RuleDraft },
): Promise<RulePreview> {
  return recorrer(
    deps,
    input.owner,
    borradorARegla(deps, input.owner, input.draft, 'borrador'),
    false,
  );
}

export function applyRuleToHistory(
  deps: CategorizationDeps,
  input: { owner: OwnerId; rule: Rule },
): Promise<RulePreview> {
  return recorrer(deps, input.owner, input.rule, true);
}

/** Guarda la regla y la aplica a la historia. */
export async function createRule(
  deps: CategorizationDeps,
  input: { owner: OwnerId; draft: RuleDraft },
): Promise<{ rule: Rule; aplicada: RulePreview }> {
  const rule = borradorARegla(deps, input.owner, input.draft);
  const categoria = await deps.accounts.findById(rule.categoria);
  if (categoria === null || categoria.owner !== input.owner) {
    throw new Error(`No existe la categoría "${rule.categoria}"`);
  }
  await deps.rules.save(rule);
  const aplicada = await applyRuleToHistory(deps, { owner: input.owner, rule });
  return { rule, aplicada };
}

/** Borrar no desclasifica: lo clasificado sigue con su constancia. */
export async function deleteRule(
  deps: Pick<CategorizationDeps, 'rules'>,
  input: { owner: OwnerId; id: string },
): Promise<void> {
  const rule = await deps.rules.findById(input.id);
  if (rule === null || rule.owner !== input.owner) {
    throw new Error(`No existe la regla "${input.id}"`);
  }
  await deps.rules.delete(input.id);
}

/** De más específica a menos; a igual especificidad, la más reciente primero. */
export async function listRules(
  deps: Pick<CategorizationDeps, 'rules'>,
  owner: OwnerId,
): Promise<Rule[]> {
  const reglas = await deps.rules.listByOwner(owner);
  return reglas.sort((a, b) => {
    const porEspecificidad = specificityOf(b) - specificityOf(a);
    if (porEspecificidad !== 0) return porEspecificidad;
    return b.creadaEn.localeCompare(a.creadaEn);
  });
}

/** La regla que aplicaría a unos hechos, si alguna. El plan 04 la consulta primero. */
export async function ruleFor(
  deps: Pick<CategorizationDeps, 'rules'>,
  input: { owner: OwnerId; facts: TransactionFacts },
): Promise<Rule | null> {
  return pickRule(await deps.rules.listByOwner(input.owner), input.facts);
}
