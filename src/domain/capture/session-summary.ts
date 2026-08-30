import type { PortalId } from '@/domain/portals/registry';

import { balanceExtractorFor, extractorFor } from './extractors';
import type { NormalizedBalance } from './normalized-balance';
import type { Capture } from './reassembler';

export interface SeenBalance {
  balance: NormalizedBalance;
  /** Instante en que el banco lo declaró: la fecha de la conciliación. */
  capturedAt: string;
}

/** Lo que una sesión de portal ha dejado ver hasta ahora, en términos del usuario. */
export interface SessionSummary {
  capturas: number;
  /** Filas de movimientos extraíbles, antes de deduplicar. */
  movimientos: number;
  saldo: SeenBalance | null;
}

/**
 * La cuenta que se concilia: la de ahorros, o la primera si ninguna se llama
 * así. Con más de una, el detalle de la conciliación deja constancia de cuál.
 */
export function pickSavingsBalance(saldos: NormalizedBalance[]): NormalizedBalance | null {
  return saldos.find((s) => /ahorro/i.test(s.nombre)) ?? saldos[0] ?? null;
}

/**
 * Resume una sesión de captura para decirle al usuario qué se ha visto.
 *
 * Existe por un hallazgo de campo: «Importar» contaba capturas, no lo que
 * había dentro, y el usuario no tenía forma de saber si el saldo del banco
 * había llegado. Sin saldo no hay conciliación ni saldo inicial, y la cuenta
 * queda en el neto de los movimientos: un número absurdo sin explicación.
 */
export function summarizeSession(portalId: PortalId, captures: Capture[]): SessionSummary {
  const extraer = extractorFor(portalId);
  const extraerSaldos = balanceExtractorFor(portalId);

  const movimientos = extraer === null ? 0 : captures.reduce((n, c) => n + extraer(c).length, 0);

  let saldo: SeenBalance | null = null;
  if (extraerSaldos !== null) {
    const conSaldos = captures
      .map((c) => ({ capturedAt: c.capturedAt, balance: pickSavingsBalance(extraerSaldos(c)) }))
      .filter((x): x is SeenBalance => x.balance !== null)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    saldo = conSaldos[0] ?? null;
  }

  return { capturas: captures.length, movimientos, saldo };
}
