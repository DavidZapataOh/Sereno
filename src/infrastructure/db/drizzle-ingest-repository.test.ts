import { sql } from 'drizzle-orm';

import type { IngestRun } from '@/domain/ingest/ingest-run';
import type { Observation } from '@/domain/ingest/observation';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { mustExist } from '@/test/must-exist';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleIngestRepository } from './drizzle-ingest-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');

const run = (
  id: string,
  fuente = 'bancolombia',
  iniciadoEn = '2026-08-28T10:00:00.000-05:00',
): IngestRun => ({
  id,
  owner,
  fuente,
  iniciadoEn,
  terminadoEn: null,
  capturas: 3,
  extraidas: 10,
  nuevas: 8,
  duplicadas: 2,
  fusionadas: 0,
  omitidas: 0,
  transferencias: 0,
  error: null,
});

const crudo = {
  fecha: '2026/08/28',
  descripcion: 'COMPRA EXITO',
  monto: 45000,
  moneda: 'COP' as const,
  tipo: 'debito' as const,
  fuente: 'bancolombia' as const,
  referencia: 'REF-1',
};

const observacion = (id: string, tx: string, extra: Partial<Observation> = {}): Observation => ({
  id,
  transactionId: transactionId(tx),
  owner,
  fuente: 'bancolombia',
  referencia: 'REF-1',
  huella: '2026-08-28|45000|exito',
  capturadoEn: '2026-08-28T10:00:00.000-05:00',
  runId: null,
  crudo,
  ...extra,
});

describe('IngestRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleIngestRepository>;

  beforeEach(async () => {
    cliente = createTestDb();
    repo = createDrizzleIngestRepository(cliente.db);

    // Las observaciones tienen clave foránea contra transacciones, y estas
    // contra cuentas: hace falta el andamiaje real.
    const cuentas = createDrizzleAccountRepository(cliente.db);
    await cuentas.save(
      createAccount({ id: accountId('a'), owner, kind: 'activo', nombre: 'A', currency: 'COP' }),
    );
    await cuentas.save(
      createAccount({ id: accountId('b'), owner, kind: 'gasto', nombre: 'B', currency: 'COP' }),
    );
    await createDrizzleTransactionRepository(cliente.db).save(
      createTransaction({
        id: transactionId('t1'),
        owner,
        fecha: '2026-08-28T00:00:00.000-05:00',
        descripcion: 'X',
        origen: { fuente: 'bancolombia', referencia: 'REF-1' },
        postings: [
          { accountId: accountId('a'), amount: money(-45000, 'COP') },
          { accountId: accountId('b'), amount: money(45000, 'COP') },
        ],
      }),
    );
  });

  afterEach(() => {
    cliente.close();
  });

  describe('corridas', () => {
    it('guarda y devuelve la última corrida de una fuente', async () => {
      await repo.saveRun(run('r1', 'bancolombia', '2026-08-27T10:00:00.000-05:00'));
      await repo.saveRun(run('r2', 'bancolombia', '2026-08-28T10:00:00.000-05:00'));
      await repo.saveRun(run('r3', 'nequi', '2026-08-29T10:00:00.000-05:00'));

      expect(mustExist(await repo.findLastRun(owner, 'bancolombia')).id).toBe('r2');
    });

    it('devuelve null si la fuente nunca se sincronizó', async () => {
      expect(await repo.findLastRun(owner, 'nequi')).toBeNull();
    });

    it('guardar la misma corrida dos veces la actualiza: así se cierra al terminar', async () => {
      await repo.saveRun(run('r1'));
      await repo.saveRun({
        ...run('r1'),
        terminadoEn: '2026-08-28T10:01:00.000-05:00',
        nuevas: 9,
      });

      const ultima = mustExist(await repo.findLastRun(owner, 'bancolombia'));
      expect(ultima.terminadoEn).toBe('2026-08-28T10:01:00.000-05:00');
      expect(ultima.nuevas).toBe(9);
    });
  });

  describe('observaciones', () => {
    it('guarda y encuentra por origen', async () => {
      await repo.saveObservation(observacion('o1', 't1'));

      const encontrada = mustExist(
        await repo.findObservationByOrigin(owner, 'bancolombia', 'REF-1'),
      );
      expect(encontrada.transactionId).toBe('t1');
      expect(encontrada.crudo).toEqual(crudo);
    });

    it('no confunde propietarios ni fuentes', async () => {
      await repo.saveObservation(observacion('o1', 't1'));

      expect(
        await repo.findObservationByOrigin(ownerId('otro'), 'bancolombia', 'REF-1'),
      ).toBeNull();
      expect(await repo.findObservationByOrigin(owner, 'nequi', 'REF-1')).toBeNull();
    });

    it('encuentra por cualquiera de varias huellas', async () => {
      await repo.saveObservation(observacion('o1', 't1', { huella: 'h-dia-1' }));

      const encontradas = await repo.findObservationsByFingerprint(owner, [
        'h-dia-0',
        'h-dia-1',
        'h-dia-2',
      ]);
      expect(encontradas.map((o) => o.id)).toEqual(['o1']);
      expect(await repo.findObservationsByFingerprint(owner, [])).toEqual([]);
    });

    it('lista las observaciones de una transacción', async () => {
      await repo.saveObservation(observacion('o1', 't1', { fuente: 'bancolombia' }));
      await repo.saveObservation(observacion('o2', 't1', { fuente: 'nequi', referencia: null }));

      expect(
        (await repo.listObservations(transactionId('t1'))).map((o) => o.fuente).sort(),
      ).toEqual(['bancolombia', 'nequi']);
    });

    it('borra una observación', async () => {
      await repo.saveObservation(observacion('o1', 't1'));
      await repo.deleteObservation('o1');
      expect(await repo.listObservations(transactionId('t1'))).toEqual([]);
    });

    it('rechaza una observación contra una transacción que no existe', async () => {
      await expect(repo.saveObservation(observacion('o1', 'fantasma'))).rejects.toThrow(
        /FOREIGN KEY/i,
      );
    });

    it('borrar la transacción arrastra sus observaciones', async () => {
      await repo.saveObservation(observacion('o1', 't1'));
      await createDrizzleTransactionRepository(cliente.db).delete(transactionId('t1'));
      expect(await repo.listObservations(transactionId('t1'))).toEqual([]);
    });

    it('un crudo corrupto en la base falla al leer, no devuelve basura', async () => {
      await repo.saveObservation(observacion('o1', 't1'));
      cliente.db.run(
        sql`UPDATE transaction_observations SET crudo = '{"monto":"no"}' WHERE id = 'o1'`,
      );

      await expect(repo.listObservations(transactionId('t1'))).rejects.toThrow();
    });
  });
});
