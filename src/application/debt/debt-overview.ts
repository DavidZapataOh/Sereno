import type { Obligation } from '@/domain/calendar/obligation';
import type { OwnerId } from '@/domain/ledger/ids';
import { absolute, subtract, sum, type Money } from '@/domain/money/money';
import { calendarDay } from '@/domain/time/colombia';

import { paymentCalendar, type CalendarDeps } from '../calendar/payment-calendar';

import { listDebts, type DebtSummary } from './list-debts';

export type DebtOverviewDeps = CalendarDeps;

export interface DebtOverview {
  total: Money;
  /**
   * Lo que se debía hace treinta días, o `null` si no había nada con qué
   * comparar. **`null` no es cero:** cero diría «no cambió nada».
   */
  hace30Dias: Money | null;
  /** Lo que cambió. Negativo es deber menos, y eso es bueno. */
  cambio: Money | null;
  deudas: DebtSummary[];
  proxima: Obligation | null;
}

/** Treinta días, no «el mes pasado»: el 31 no existe todos los meses. */
const DIAS = 30;

/**
 * Cuánto se debe hoy, cuánto se debía hace un mes, y qué vence pronto.
 *
 * **Lo de hace treinta días sale del ledger**, no de una instantánea guardada:
 * el ledger tiene todos los asientos con su fecha, así que sabe lo que se debía
 * cualquier día. Guardarlo aparte sería una segunda verdad que puede discrepar.
 */
export async function debtOverview(
  deps: DebtOverviewDeps,
  input: { owner: OwnerId },
): Promise<DebtOverview> {
  const hoy = calendarDay(deps.clock());
  const deudas = await listDebts(deps, input.owner);
  const moneda = deudas[0]?.saldo.currency ?? 'COP';

  // En el ledger un pasivo es negativo; lo que se debe va en positivo.
  const total = absolute(
    sum(
      deudas.map((d) => d.saldo),
      moneda,
    ),
  );

  const corte = haceDias(hoy, DIAS);
  const saldosViejos = await Promise.all(
    deudas.map((d) =>
      deps.accounts.balanceOf(d.accountId, { hasta: `${corte}T23:59:59.999-05:00` }),
    ),
  );
  // Sin ningún asiento antes del corte no hay con qué comparar. Un cero ahí
  // diría «no debías nada», y lo que pasa es que la app no existía todavía.
  const habiaHistoria = saldosViejos.some((s) => s.amount !== 0n);
  const hace30Dias = habiaHistoria ? absolute(sum(saldosViejos, moneda)) : null;

  const obligaciones = await paymentCalendar(deps, {
    owner: input.owner,
    desde: hoy,
    hasta: haceDias(hoy, -60),
  });

  return {
    total,
    hace30Dias,
    cambio: hace30Dias === null ? null : subtract(total, hace30Dias),
    deudas,
    proxima: obligaciones.find((o) => o.estado !== 'pagada') ?? null,
  };
}

function haceDias(dia: string, dias: number): string {
  const fecha = new Date(Date.parse(`${dia}T12:00:00.000-05:00`) - dias * 86_400_000);
  return `${String(fecha.getUTCFullYear())}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
}
