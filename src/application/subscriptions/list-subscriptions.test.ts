import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { ownerId } from '@/domain/ledger/ids';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryCategoryRepository } from '@/test/fakes/in-memory-category-repository';
import { createInMemoryClassificationRepository } from '@/test/fakes/in-memory-classification-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { ingestNormalized } from '../ingest/ingest-normalized';
import type { IngestDeps } from '../ingest/types';

import { listSubscriptions, type SubscriptionsDeps } from './list-subscriptions';

const owner = ownerId('david');
const HOY = '2026-08-31T10:00:00.000-05:00';

function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const d: IngestDeps & SubscriptionsDeps = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    categories: createInMemoryCategoryRepository(),
    classifications: createInMemoryClassificationRepository(),
    ids: createSequentialIds('id'),
    clock: () => HOY,
  };
  return { ...d, accounts, transactions };
}

const compra = (descripcion: string, fecha: string, monto: number): NormalizedTransaction => ({
  fecha,
  descripcion,
  monto,
  moneda: 'COP',
  tipo: 'debito',
  fuente: 'bancolombia',
  referencia: `${descripcion}-${fecha}`,
});

async function sembrar(d: ReturnType<typeof deps>, lote: NormalizedTransaction[]) {
  await ingestNormalized(d, {
    owner,
    fuente: 'bancolombia',
    canal: 'web' as const,
    nombreFuente: 'Bancolombia',
    lote,
    capturadoEn: '2026-08-31T10:00:00.000-05:00',
  });
}

describe('listSubscriptions', () => {
  it('detecta una suscripción mensual del ledger de verdad', async () => {
    const d = deps();
    await sembrar(d, [
      compra('NETFLIX.COM', '2026/06/05', 38900),
      compra('NETFLIX.COM', '2026/07/05', 38900),
      compra('NETFLIX.COM', '2026/08/05', 38900),
    ]);

    const { suscripciones } = await listSubscriptions(d, { owner });

    expect(suscripciones).toHaveLength(1);
    expect(suscripciones[0]).toMatchObject({ cadencia: 'mensual', cambio: null });
  });

  it('marca la que subió de precio, con cuánto subió', async () => {
    const d = deps();
    await sembrar(d, [
      compra('NETFLIX.COM', '2026/06/05', 38900),
      compra('NETFLIX.COM', '2026/07/05', 38900),
      compra('NETFLIX.COM', '2026/08/05', 44900),
    ]);

    const { suscripciones } = await listSubscriptions(d, { owner });

    expect(suscripciones[0]?.cambio?.porcentaje).toBeCloseTo(15.4, 1);
  });

  it('suma el total mensual', async () => {
    const d = deps();
    await sembrar(d, [
      compra('NETFLIX.COM', '2026/06/05', 38900),
      compra('NETFLIX.COM', '2026/07/05', 38900),
      compra('NETFLIX.COM', '2026/08/05', 38900),
      compra('SPOTIFY', '2026/06/20', 16900),
      compra('SPOTIFY', '2026/07/20', 16900),
      compra('SPOTIFY', '2026/08/20', 16900),
    ]);

    const { totalMensual } = await listSubscriptions(d, { owner });

    expect(totalMensual.amount).toBe(55_800n);
  });

  /**
   * Sumar una cancelada diría que se va una plata que ya no se va.
   */
  it('el total no incluye las canceladas', async () => {
    const d = deps();
    await sembrar(d, [
      compra('NETFLIX.COM', '2026/06/05', 38900),
      compra('NETFLIX.COM', '2026/07/05', 38900),
      compra('NETFLIX.COM', '2026/08/05', 38900),
      // Cancelada hace medio año.
      compra('VIEJO SERVICIO', '2026/01/10', 20000),
      compra('VIEJO SERVICIO', '2026/02/10', 20000),
      compra('VIEJO SERVICIO', '2026/03/10', 20000),
    ]);

    const { suscripciones, totalMensual } = await listSubscriptions(d, { owner });

    expect(suscripciones).toHaveLength(2);
    expect(totalMensual.amount).toBe(38_900n);
  });

  it('una anual aporta su doceava parte al total mensual', async () => {
    const d = deps();
    await sembrar(d, [
      compra('DOMINIO ANUAL', '2024/09/01', 120000),
      compra('DOMINIO ANUAL', '2025/09/01', 120000),
      compra('DOMINIO ANUAL', '2026/08/28', 120000),
    ]);

    const { totalMensual } = await listSubscriptions(d, { owner });

    // 120.000 / 12 = 10.000, con el redondeo del escalado por mil.
    expect(totalMensual.amount).toBeGreaterThan(9_900n);
    expect(totalMensual.amount).toBeLessThan(10_100n);
  });

  it('sin movimientos no inventa suscripciones ni divide por cero', async () => {
    const d = deps();

    const resumen = await listSubscriptions(d, { owner });

    expect(resumen.suscripciones).toEqual([]);
    expect(resumen.totalMensual.amount).toBe(0n);
  });

  it('unas compras sueltas en el mismo sitio no salen como suscripción', async () => {
    const d = deps();
    await sembrar(d, [
      compra('CAFE DE LA ESQUINA', '2026/08/03', 8000),
      compra('CAFE DE LA ESQUINA', '2026/08/04', 9000),
      compra('CAFE DE LA ESQUINA', '2026/08/19', 8500),
    ]);

    expect((await listSubscriptions(d, { owner })).suscripciones).toEqual([]);
  });
});
