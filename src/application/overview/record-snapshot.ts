import type { OwnerId } from '@/domain/ledger/ids';
import { snapshot, type Snapshot } from '@/domain/overview/snapshot';
import type { SnapshotRepository } from '@/domain/overview/snapshot-repository';
import { calendarDay } from '@/domain/time/colombia';

import { getOverview, type OverviewDeps } from './get-overview';

export interface SnapshotDeps extends OverviewDeps {
  snapshots: SnapshotRepository;
  clock: () => string;
}

/**
 * Guarda cuánto vale el patrimonio hoy, con las tasas de hoy.
 *
 * Se llama al abrir la app. Dos arranques el mismo día dejan **un** punto: el
 * último, que es el que más sabe.
 *
 * El valor se guarda ya calculado y no se recalcula nunca. Si la serie se
 * recalculara con las tasas de hoy, la línea del pasado cambiaría cada mañana:
 * un dólar que sube haría parecer que uno ahorró en marzo.
 */
export async function recordSnapshot(
  deps: SnapshotDeps,
  input: { owner: OwnerId; dia?: string },
): Promise<Snapshot> {
  const overview = await getOverview(deps, input.owner);
  const tomadaEn = deps.clock();

  const instantanea = snapshot({
    owner: input.owner,
    dia: input.dia ?? calendarDay(tomadaEn),
    patrimonio: overview.patrimonio,
    // Con qué se valoró. Sin esto, dentro de un mes el número no dice si las
    // tasas eran de ese día o unas viejas que se quedaron pegadas.
    //
    // «Ninguna» no es un fallo: si todo está en pesos, no hizo falta convertir
    // nada. Lo que sí es un aviso es que quedara algo sin valorar, y eso se
    // dice aparte para no confundir las dos cosas.
    tasas: describirTasas(overview.tasasUsadas, overview.sinValorar.length),
    tomadaEn,
  });

  await deps.snapshots.guardar(instantanea);
  return instantanea;
}

/**
 * La serie del patrimonio entre dos días.
 *
 * **Un día sin instantánea es un hueco, no un cero.** Un cero en la gráfica se
 * lee como «se quedó sin nada», y lo que pasó es que la app no se abrió.
 */
export function netWorthSeries(
  deps: SnapshotDeps,
  input: { owner: OwnerId; desde: string; hasta: string },
): Promise<Snapshot[]> {
  return deps.snapshots.serie(input.owner, input.desde, input.hasta);
}

function describirTasas(
  usadas: readonly { origen: string; momento: string }[],
  sinValorar: number,
): string {
  const base =
    usadas.length === 0
      ? 'ninguna: todo estaba en pesos'
      : usadas.map((t) => `${t.origen} (${t.momento})`).join(' × ');
  return sinValorar === 0 ? base : `${base} — ${String(sinValorar)} sin valorar`;
}
