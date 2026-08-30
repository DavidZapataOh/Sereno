import { findTransferPairs, mergeAsTransfer } from '@/domain/ingest/transfers';
import type { OwnerId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import type { Transaction } from '@/domain/ledger/transaction';

import type { IngestDeps } from './types';

const VENTANA_POR_DEFECTO = 5;

async function candidatas(
  deps: IngestDeps,
  owner: OwnerId,
  desde?: string,
): Promise<Transaction[]> {
  const resultado = new Map<string, Transaction>();
  for (const contraparte of ['gastos-sin-clasificar', 'ingresos-sin-clasificar'] as const) {
    let cursor: string | undefined;
    do {
      const pagina = await deps.transactions.list(
        owner,
        { accountId: systemAccountId(contraparte), desde },
        { limit: 200, cursor },
      );
      pagina.items.forEach((t) => resultado.set(t.id, t));
      cursor = pagina.nextCursor ?? undefined;
    } while (cursor !== undefined);
  }
  return [...resultado.values()];
}

/**
 * Busca pares salida/entrada entre cuentas propias y los funde.
 *
 * Se corre después de cada ingesta. Los pares que el usuario deshizo se
 * respetan: el detector recibe sus claves y no los vuelve a proponer.
 *
 * El orden de escritura está pensado para que un fallo a medias deje rastro:
 * primero el registro (con todo lo necesario para restaurar), luego se quita
 * la entrada, luego se funde. Si falla entre medias, el registro dice qué había.
 */
export async function detectTransfers(
  deps: IngestDeps,
  input: { owner: OwnerId; ventanaDias?: number; desde?: string },
): Promise<{ detectadas: number }> {
  const excluir = await deps.transfers.undoneKeys(input.owner);
  const pares = findTransferPairs(await candidatas(deps, input.owner, input.desde), {
    ventanaDias: input.ventanaDias ?? VENTANA_POR_DEFECTO,
    excluir,
  });

  for (const par of pares) {
    const observacionesEntrada = await deps.ingest.listObservations(par.entrada.id);
    const fundida = mergeAsTransfer(par);

    await deps.transfers.save({
      id: deps.ids.next(),
      owner: input.owner,
      transactionId: fundida.id,
      salida: par.salida,
      entrada: par.entrada,
      observacionesEntrada,
      estado: 'detectada',
      detectadaEn: deps.clock(),
      resueltaEn: null,
    });
    for (const o of observacionesEntrada) await deps.ingest.deleteObservation(o.id);
    await deps.transactions.delete(par.entrada.id);
    await deps.transactions.save(fundida);
  }

  return { detectadas: pares.length };
}
