import { categoryAccountId, DEFAULT_CATEGORIES } from '@/domain/categorization/taxonomy';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import { subtract, sum, zero, type Money } from '@/domain/money/money';
import { finDeMes, mesAnterior } from '@/domain/time/month';

export interface ObservedIncomeDeps {
  accounts: AccountRepository;
}

export interface IngresoObservado {
  /** El promedio mensual, o `null` si no hay ningún mes con datos. */
  promedio: Money | null;
  /** Sobre cuántos meses. Un promedio de un mes no es un promedio. */
  meses: number;
}

/** Cuántos meses atrás se mira. */
const VENTANA = 3;

/**
 * Lo que el ledger observa que entra cada mes.
 *
 * **Observado, no declarado**: lo declarado es lo que uno cree ganar. Y `null`
 * cuando no hay ningún mes con datos: devolver cero diría «no ganas nada», que
 * es una afirmación distinta y falsa.
 *
 * Un mes sin movimiento no cuenta como «gané cero»: cuenta como un mes en el
 * que la app no estaba mirando.
 */
export async function observedIncome(
  deps: ObservedIncomeDeps,
  input: { hasta: string; moneda: Money['currency'] },
): Promise<IngresoObservado> {
  const slugs = DEFAULT_CATEGORIES.filter((c) => c.kind === 'ingreso').map((c) => c.slug);
  const meses: Money[] = [];

  let cursor = mesAnterior(input.hasta.slice(0, 7));
  for (let i = 0; i < VENTANA; i += 1) {
    let delMes = zero(input.moneda);
    for (const slug of slugs) {
      const id = categoryAccountId(slug);
      if ((await deps.accounts.findById(id)) === null) continue;
      const cierre = await deps.accounts.balanceOf(id, { hasta: finDeMes(cursor) });
      const inicio = await deps.accounts.balanceOf(id, { hasta: finDeMes(mesAnterior(cursor)) });
      // El ingreso llega como crédito: negativo sobre la cuenta de ingreso.
      delMes = { amount: delMes.amount + subtract(inicio, cierre).amount, currency: input.moneda };
    }
    if (delMes.amount !== 0n) meses.push(delMes);
    cursor = mesAnterior(cursor);
  }

  if (meses.length === 0) return { promedio: null, meses: 0 };
  return {
    promedio: {
      amount: sum(meses, input.moneda).amount / BigInt(meses.length),
      currency: input.moneda,
    },
    meses: meses.length,
  };
}
