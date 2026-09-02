import { resumenPublicable, type ResumenPublicable } from '@/domain/assistant/publishable-summary';
import type { OwnerId } from '@/domain/ledger/ids';
import type { AssistantStatus, ServerClient } from '@/domain/sync/server-client';
import { calendarDay } from '@/domain/time/colombia';
import { diasAntes } from '@/domain/time/month';

import { observedIncome, type ObservedIncomeDeps } from '../income/observed-income';
import { behaviorMetrics, type BehaviorDeps } from '../metrics/behavior-metrics';
import { getOverview, type OverviewDeps } from '../overview/get-overview';
import { netWorthSeries, type SnapshotDeps } from '../overview/record-snapshot';
import { porCategoria, type ReportDeps } from '../reports/spending-report';

export interface AskDeps
  extends OverviewDeps, ReportDeps, BehaviorDeps, SnapshotDeps, ObservedIncomeDeps {
  servidor: Pick<ServerClient, 'preguntar'>;
  clock: () => string;
}

/** Cuántos días atrás se busca el patrimonio con que comparar. */
const DIAS_ATRAS = 30;
/** Cuánto se retrocede buscando una instantánea. Sin abrir la app no hay punto. */
const MARGEN_DIAS = 7;

/**
 * Lo que sale del teléfono, armado desde el ledger.
 *
 * **Todo lo que se manda pasa por `resumenPublicable`**, que filtra contra la
 * taxonomía. Aquí no se construye el objeto a mano ni se le añade nada después:
 * si mañana alguien quiere mandar un comercio, tiene que romper esa función a
 * propósito, y su prueba lo dice.
 */
export async function armarResumen(
  deps: AskDeps,
  input: { owner: OwnerId },
): Promise<ResumenPublicable> {
  const hoy = calendarDay(deps.clock());
  const mes = hoy.slice(0, 7);

  const [overview, categorias, metricas, ingreso] = await Promise.all([
    getOverview(deps, input.owner),
    porCategoria(deps, { owner: input.owner, mes }),
    behaviorMetrics(deps, { owner: input.owner }),
    observedIncome(deps, { hasta: hoy, moneda: 'COP' }),
  ]);

  // El saldo es lo que hay en cuentas de activo; la deuda, lo que se debe. El
  // pasivo vive en negativo en el ledger, y aquí se enseña en positivo: «debo
  // -1.897.917» no lo entiende nadie.
  let saldo = 0;
  let deuda = 0;
  for (const fila of [...overview.cuentas, ...overview.polvo.cuentas]) {
    const enPesos = fila.enPesos;
    if (enPesos === null) continue;
    if (fila.account.kind === 'activo') saldo += Number(enPesos.amount);
    if (fila.account.kind === 'pasivo') deuda += Number(-enPesos.amount);
  }

  const gastoPorCategoria: Record<string, number> = {};
  for (const fila of categorias) gastoPorCategoria[fila.categoria] = Number(fila.total.amount);

  const valorDe = (clave: string): number | null =>
    metricas.metricas.find((m) => m.clave === clave)?.valor ?? null;

  return resumenPublicable({
    gastoPorCategoria,
    saldoTotal: saldo,
    deudaTotal: deuda,
    patrimonio: Number(overview.patrimonio.amount),
    patrimonioHace30Dias: await patrimonioDeHace(deps, input.owner, hoy),
    tasaDeAhorroPct: valorDe('tasa-de-ahorro'),
    mesesDeColchon: valorDe('meses-de-colchon'),
    ingresoMensual: ingreso.promedio === null ? null : Number(ingreso.promedio.amount),
  });
}

/**
 * El patrimonio de hace un mes, del histórico ya calculado.
 *
 * **No se recalcula con las tasas de hoy**: eso haría que el pasado cambiara
 * cada mañana. Y si no hay instantánea de esos días —la app no se abrió— va
 * `null`, no cero: cero diría «no tenías nada».
 */
async function patrimonioDeHace(
  deps: SnapshotDeps,
  owner: OwnerId,
  hoy: string,
): Promise<number | null> {
  const hasta = diasAntes(hoy, DIAS_ATRAS);
  const serie = await netWorthSeries(deps, {
    owner,
    desde: diasAntes(hasta, MARGEN_DIAS),
    hasta,
  });
  const ultima = serie.at(-1);
  return ultima === undefined ? null : Number(ultima.patrimonio.amount);
}

/**
 * Preguntar. Devuelve también **qué se envió**, para poder enseñarlo.
 *
 * Que la respuesta traiga las cifras que usó es la mitad; la otra mitad es que
 * se pueda ver, sin creerle a nadie, exactamente qué salió del teléfono.
 */
export async function ask(
  deps: AskDeps,
  input: { owner: OwnerId; pregunta: string },
): Promise<{ enviado: ResumenPublicable; resultado: AssistantStatus }> {
  const enviado = await armarResumen(deps, { owner: input.owner });
  return { enviado, resultado: await deps.servidor.preguntar(enviado, input.pregunta) };
}
