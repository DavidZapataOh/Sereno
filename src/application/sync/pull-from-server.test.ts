import { accountId, ownerId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import type { ServerMovement } from '@/domain/sync/server-client';
import { categorizationDeps } from '@/test/fakes/categorization-deps';
import { createFakeServerClient } from '@/test/fakes/fake-server-client';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemorySyncStateRepository } from '@/test/fakes/in-memory-sync-state-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';

import { pullFromServer } from './pull-from-server';

const owner = ownerId('david');
const movimiento = (
  secuencia: number,
  referencia: string,
  extra: Partial<ServerMovement> = {},
) => ({
  id: `bancolombia:${referencia}`,
  secuencia,
  fecha: '2026-08-30T10:00:00.000-05:00',
  descripcion: `COMPRA ${referencia}`,
  monto: 45000,
  moneda: 'COP' as const,
  tipo: 'debito' as const,
  fuente: 'bancolombia' as const,
  referencia,
  ...extra,
});

/**
 * `pullFromServer` necesita los puertos de ingesta (sprint 04) además de los
 * de categorización (sprint 05): lo que trae entra por la misma tubería.
 */
function deps(movimientos: ServerMovement[] = [movimiento(1, 'A'), movimiento(2, 'B')]) {
  const base = categorizationDeps();
  return {
    ...base,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    servidor: createFakeServerClient(movimientos),
    sync: createInMemorySyncStateRepository(),
  };
}

describe('pullFromServer', () => {
  it('trae, ingiere por la tubería del sprint 04 y guarda el cursor', async () => {
    const d = deps();
    const resumen = await pullFromServer(d, { owner });

    expect(resumen).toMatchObject({ recibidos: 2, nuevos: 2, cursor: 2 });
    expect(d.transactions.all()).toHaveLength(2);
    expect(await d.sync.leerCursor()).toBe(2);
    expect(d.servidor.confirmados()).toEqual([2]);
  });

  it('la segunda vez no trae nada y no duplica', async () => {
    const d = deps();
    await pullFromServer(d, { owner });
    const segunda = await pullFromServer(d, { owner });

    expect(segunda).toMatchObject({ recibidos: 0, nuevos: 0 });
    expect(d.transactions.all()).toHaveLength(2);
  });

  it('agrupa por fuente: cada una entra a su cuenta, con su naturaleza', async () => {
    const d = deps([
      movimiento(1, 'A'),
      movimiento(2, 'N1', { fuente: 'nu', id: 'nu:N1', tipo: 'credito' }),
    ]);
    await pullFromServer(d, { owner });

    expect(await d.accounts.findById(accountId('bancolombia:ahorros'))).toMatchObject({
      kind: 'activo',
    });
    expect(await d.accounts.findById(accountId('nu:tarjeta'))).toMatchObject({ kind: 'pasivo' });
  });

  it('sigue paginando mientras el servidor diga que hay más', async () => {
    const d = deps([movimiento(1, 'A'), movimiento(2, 'B'), movimiento(3, 'C')]);
    d.servidor.limitarPaginaA(1);

    const resumen = await pullFromServer(d, { owner });
    expect(resumen).toMatchObject({ paginas: 3, recibidos: 3, nuevos: 3 });
  });

  it('el tope de páginas evita una vuelta infinita', async () => {
    const d = deps([movimiento(1, 'A'), movimiento(2, 'B'), movimiento(3, 'C')]);
    d.servidor.limitarPaginaA(1);

    const resumen = await pullFromServer(d, { owner, paginas: 2 });
    expect(resumen.paginas).toBe(2);
    expect(resumen.nuevos).toBe(2);
  });

  it('si la confirmación falla, el cursor local ya avanzó y no se pierde nada', async () => {
    const d = deps();
    d.servidor.fallarConfirmacion();

    const resumen = await pullFromServer(d, { owner });
    expect(resumen.nuevos).toBe(2);
    expect(await d.sync.leerCursor()).toBe(2);
  });

  it('si la red se cae, el cursor no avanza y la próxima vez se vuelve a traer', async () => {
    const d = deps();
    d.servidor.fallarTraida();

    await expect(pullFromServer(d, { owner })).rejects.toThrow();
    expect(await d.sync.leerCursor()).toBe(0);
    expect(d.transactions.all()).toHaveLength(0);

    d.servidor.dejarDeFallar();
    expect((await pullFromServer(d, { owner })).nuevos).toBe(2);
  });

  it('si la ingesta revienta a mitad, lo ya guardado se conserva y el cursor no miente', async () => {
    // El cursor se guarda DESPUÉS de ingerir: al reintentar se reprocesa, y
    // los ids deterministas hacen que reprocesar no duplique.
    const d = deps();
    const original = d.transactions.save.bind(d.transactions);
    let veces = 0;
    d.transactions.save = (t) => {
      veces += 1;
      return veces === 2 ? Promise.reject(new Error('base ocupada')) : original(t);
    };

    await expect(pullFromServer(d, { owner })).rejects.toThrow();
    expect(await d.sync.leerCursor()).toBe(0);

    d.transactions.save = original;
    await pullFromServer(d, { owner });
    expect(d.transactions.all()).toHaveLength(2);
  });

  it('lo anterior al día en que se conectó la cuenta se cuenta y no entra', async () => {
    const d = deps([movimiento(1, 'V', { fecha: '2020-01-01T10:00:00.000-05:00' })]);
    const resumen = await pullFromServer(d, { owner });

    expect(resumen).toMatchObject({ recibidos: 1, nuevos: 0, anteriores: 1 });
    expect((await d.accounts.balanceOf(systemAccountId('gastos-sin-clasificar'))).amount).toBe(0n);
  });

  it('deja constancia de cuándo fue la última traída', async () => {
    const d = deps();
    expect(await d.sync.ultimaTraida()).toBeNull();
    await pullFromServer(d, { owner });
    expect(await d.sync.ultimaTraida()).toBe(d.clock());
  });
});
