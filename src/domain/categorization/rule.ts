import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import { basicClean } from '@/domain/text/bank-description';

import { isCategoryAccount } from './taxonomy';

export type RuleField = 'comercio' | 'descripcion';
export type RuleOperator = 'es' | 'empieza' | 'contiene';

/** Los hechos sobre los que se evalúa una regla: ya limpios (plan 01). */
export interface RuleFacts {
  comercio: string;
  descripcion: string;
}

/**
 * «Cuando el comercio contenga *exito*, es Mercado.»
 *
 * No hay orden manual: entre las que coinciden gana la más específica, y a
 * igual especificidad la más reciente. Es predecible, cabe en una frase y no
 * pide al usuario que arrastre filas en un teléfono.
 */
export interface Rule {
  id: string;
  owner: OwnerId;
  campo: RuleField;
  operador: RuleOperator;
  valor: string;
  categoria: AccountId;
  creadaEn: string;
  activa: boolean;
}

export function createRule(input: Rule): Rule {
  const valor = basicClean(input.valor);
  if (valor.length === 0) throw new Error('La regla necesita un valor');
  if (!isCategoryAccount(input.categoria)) {
    throw new Error(`"${input.categoria}" no es una categoría`);
  }
  return { ...input, valor };
}

/** «Contiene» es por palabra entera: «ara» no coincide con «carulla». */
function contienePalabra(texto: string, valor: string): boolean {
  return ` ${texto} `.includes(` ${valor} `);
}

export function ruleMatches(rule: Rule, hechos: RuleFacts): boolean {
  if (!rule.activa) return false;
  const texto = rule.campo === 'comercio' ? hechos.comercio : hechos.descripcion;
  switch (rule.operador) {
    case 'es':
      return texto === rule.valor;
    case 'empieza':
      return texto.startsWith(rule.valor);
    case 'contiene':
      return contienePalabra(texto, rule.valor);
  }
}

const PESO: Record<RuleOperator, number> = { es: 3000, empieza: 2000, contiene: 1000 };

export function specificityOf(rule: Rule): number {
  return PESO[rule.operador] + rule.valor.length;
}

/** Entre las que coinciden: la más específica; luego la más reciente; luego el id mayor. */
export function pickRule(rules: readonly Rule[], hechos: RuleFacts): Rule | null {
  const candidatas = rules.filter((r) => ruleMatches(r, hechos));
  if (candidatas.length === 0) return null;
  return candidatas.reduce((mejor, r) => {
    const porEspecificidad = specificityOf(r) - specificityOf(mejor);
    if (porEspecificidad !== 0) return porEspecificidad > 0 ? r : mejor;
    const porFecha = r.creadaEn.localeCompare(mejor.creadaEn);
    if (porFecha !== 0) return porFecha > 0 ? r : mejor;
    return r.id > mejor.id ? r : mejor;
  });
}
