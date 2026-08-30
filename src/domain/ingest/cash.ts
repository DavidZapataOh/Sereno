import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';

/**
 * Descripciones con las que los bancos colombianos etiquetan un retiro de
 * efectivo: cajero automático, corresponsal bancario, «ATM». Se exige que la
 * palabra «retiro» vaya acompañada del canal, porque «retiro» sola también
 * nombra sacar dinero de una inversión, que no es efectivo en la mano.
 */
const RETIRO_EFECTIVO = /\bretiro\b.*\b(cajero|efectivo|atm|corresponsal)\b/i;

export function isCashWithdrawal(n: NormalizedTransaction): boolean {
  return (
    n.tipo === 'debito' && RETIRO_EFECTIVO.test(n.descripcion.normalize('NFD').replace(/[̀-ͯ]/g, ''))
  );
}
