import type { ClassificationBatch } from '@/domain/categorization/batch';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';

import { createDrizzleBatchRepository } from './drizzle-batch-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const lote = (
  id: string,
  creadoEn: string,
  extra: Partial<ClassificationBatch> = {},
): ClassificationBatch => ({
  id,
  owner,
  comercio: 'panaderia dona',
  cambios: [
    {
      transactionId: transactionId('bancolombia:P1'),
      antes: null,
      despues: accountId('categoria:antojos'),
    },
    {
      transactionId: transactionId('bancolombia:P2'),
      antes: {
        categoria: accountId('categoria:mercado'),
        origen: 'catalogo',
        reglaId: null,
        confianza: 80,
      },
      despues: accountId('categoria:antojos'),
    },
  ],
  reglaId: null,
  creadoEn,
  deshechoEn: null,
  ...extra,
});

describe('BatchRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleBatchRepository>;

  beforeEach(() => {
    cliente = createTestDb();
    repo = createDrizzleBatchRepository(cliente.db);
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda y recupera con los cambios intactos', async () => {
    await repo.save(lote('b1', '2026-08-30T10:00:00.000-05:00'));
    expect(await repo.findById('b1')).toEqual(lote('b1', '2026-08-30T10:00:00.000-05:00'));
    expect(await repo.findById('nada')).toBeNull();
  });

  it('el último es el más reciente no deshecho; guardar de nuevo actualiza', async () => {
    await repo.save(lote('b1', '2026-08-30T10:00:00.000-05:00'));
    await repo.save(lote('b2', '2026-08-30T11:00:00.000-05:00'));
    expect((await repo.findLatest(owner))?.id).toBe('b2');

    await repo.save(
      lote('b2', '2026-08-30T11:00:00.000-05:00', { deshechoEn: '2026-08-30T12:00:00.000-05:00' }),
    );
    expect((await repo.findLatest(owner))?.id).toBe('b1');
    expect(await repo.findLatest(ownerId('otro'))).toBeNull();
  });
});
