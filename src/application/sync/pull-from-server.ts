import { startDayOf } from '@/domain/ingest/account-start';
import type { OwnerId } from '@/domain/ledger/ids';
import { SOURCES, type SourceId } from '@/domain/sources/registry';
import { corteMasTarde, mailStartDay } from '@/domain/sync/mail-start';
import type {
  ServerClient,
  ServerMovement,
  SyncStateRepository,
} from '@/domain/sync/server-client';

import { ingestNormalized } from '../ingest/ingest-normalized';
import type { IngestDeps } from '../ingest/types';

export interface PullDeps extends IngestDeps {
  servidor: ServerClient;
  sync: SyncStateRepository;
}

export interface PullSummary {
  paginas: number;
  recibidos: number;
  nuevos: number;
  duplicados: number;
  anteriores: number;
  cursor: number;
}

const TAMANO_PAGINA = 200;
/** Tope de seguridad: si el servidor dijera «hay más» para siempre, esto para. */
const MAX_PAGINAS = 50;

function agruparPorFuente(movimientos: readonly ServerMovement[]): Map<SourceId, ServerMovement[]> {
  const grupos = new Map<SourceId, ServerMovement[]>();
  for (const m of movimientos) {
    const lote = grupos.get(m.fuente) ?? [];
    lote.push(m);
    grupos.set(m.fuente, lote);
  }
  return grupos;
}

/**
 * Trae del servidor lo que aún no está en el teléfono y lo mete al ledger.
 *
 * El cursor local se guarda **después** de ingerir. Si algo se corta, la
 * vuelta siguiente vuelve a traer lo mismo, y los ids deterministas del
 * sprint 04 hacen que reprocesar no duplique nada. La confirmación al
 * servidor va al final y no manda: si falla, no pasa nada.
 */
export async function pullFromServer(
  deps: PullDeps,
  input: { owner: OwnerId; paginas?: number },
): Promise<PullSummary> {
  const resumen: PullSummary = {
    paginas: 0,
    recibidos: 0,
    nuevos: 0,
    duplicados: 0,
    anteriores: 0,
    cursor: await deps.sync.leerCursor(),
  };
  const tope = input.paginas ?? MAX_PAGINAS;

  // El corte del correo se fija **antes** de ingerir nada y no se vuelve a
  // mover. Si esto se hiciera después, una traída cortada a medias dejaría el
  // corte sin poner y la siguiente vez entraría el buzón entero.
  const guardado = await deps.sync.leerInicioCorreo();
  const inicioCorreo = mailStartDay(guardado, deps.clock());
  if (guardado === null) await deps.sync.escribirInicioCorreo(inicioCorreo);

  let hayMas = true;
  while (hayMas && resumen.paginas < tope) {
    const pagina = await deps.servidor.traer(resumen.cursor, TAMANO_PAGINA);
    resumen.paginas += 1;
    resumen.recibidos += pagina.movimientos.length;
    if (pagina.movimientos.length === 0) break;

    // `ingestNormalized` trabaja con un lote de una sola fuente: una página
    // puede traer de varias, así que se agrupa antes.
    for (const [fuente, lote] of agruparPorFuente(pagina.movimientos)) {
      const primera = await deps.ingest.findFirstRun(input.owner, fuente);
      const parcial = await ingestNormalized(deps, {
        owner: input.owner,
        fuente,
        // Todo lo que entrega el servidor salió de un correo.
        canal: 'correo',
        nombreFuente: SOURCES[fuente].nombre,
        lote,
        capturadoEn: deps.clock(),
        // Dos cortes, y manda el más tarde: el de conectar la fuente
        // (sprint 04) y el de conectar el correo. Conectar el correo trae de
        // golpe lo que el buzón guarde, y eso descuadra unos saldos que el
        // usuario ya había cuadrado a mano.
        desde: corteMasTarde(inicioCorreo, startDayOf(primera, deps.clock())),
      });
      resumen.nuevos += parcial.nuevas;
      resumen.duplicados += parcial.duplicadas;
      resumen.anteriores += parcial.anteriores;
    }

    // Solo aquí, con todo ya guardado.
    resumen.cursor = pagina.cursor;
    await deps.sync.escribirCursor(pagina.cursor);
    hayMas = pagina.hayMas;
  }

  await deps.sync.marcarTraida(deps.clock());
  // La confirmación es cortesía: el servidor la usa para saber qué entregó.
  try {
    await deps.servidor.confirmar(resumen.cursor);
  } catch {
    // Sin ella no se pierde nada; el cursor local ya avanzó.
  }
  return resumen;
}
