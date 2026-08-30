import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';

/**
 * Descripciones con las que los bancos colombianos etiquetan un retiro de
 * efectivo: cajero automático, corresponsal bancario, «ATM». Se exige que la
 * palabra «retiro» vaya acompañada del canal, porque «retiro» sola también
 * nombra sacar dinero de una inversión, que no es efectivo en la mano.
 */
const RETIRO_EFECTIVO = /\bretiro\b.*\b(cajero|efectivo|atm|corresponsal)\b/i;

/**
 * La forma del correo: «Retiraste $40.000,00 en SUC_CRA70_3 de tu T.Deb».
 *
 * No trae ninguna de las palabras que delatan al retiro del portal, así que
 * se reconoce el verbo. Conjugado en segunda persona solo lo usa el banco
 * para esto; «retiro de cesantías» —el falso positivo que preocupa— no dice
 * «retiraste». Y si alguno se cuela, el usuario lo reclasifica en un toque
 * (sprint 05); lo contrario, perder el efectivo, no se nota.
 */
const RETIRASTE = /\bretiraste\b/i;

export function isCashWithdrawal(n: NormalizedTransaction): boolean {
  if (n.tipo !== 'debito') return false;
  const texto = n.descripcion.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return RETIRO_EFECTIVO.test(texto) || RETIRASTE.test(texto);
}
