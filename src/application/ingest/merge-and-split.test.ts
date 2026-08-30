import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { ownerId, transactionId } from '@/domain/ledger/ids';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';
import { mustExist } from '@/test/must-exist';

import { ingestNormalized } from './ingest-normalized';
import { mergeTransactions } from './merge-transactions';
import { splitObservation } from './split-observation';
import type { IngestDeps } from './types';

const owner = ownerId('david');

function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const ingest = createInMemoryIngestRepository();
  const d: IngestDeps = {
    accounts,
    transactions,
    ingest,
    transfers: createInMemoryTransferRepository(),
    ids: createSequentialIds('run'),
    clock: () => '2026-08-28T10:00:00.000-05:00',
  };
  return { ...d, transactions, ingest };
}

const web: NormalizedTransaction = {
  fecha: '2026/08/28',
  descripcion: 'COMPRA EXITO SUR',
  monto: 45000,
  moneda: 'COP',
  tipo: 'debito',
  fuente: 'bancolombia',
  referencia: 'REF-1',
};
const correo: NormalizedTransaction = {
  ...web,
  fecha: '2026/08/27',
  descripcion: 'Pago en EXITO SUR',
  fuente: 'nequi',
  referencia: null,
};

const porWeb = (lote: NormalizedTransaction[]) => ({
  owner,
  fuente: 'bancolombia' as const,
  nombreFuente: 'Bancolombia',
  lote,
  capturadoEn: '2026-08-28T10:00:00.000-05:00',
});
const porCorreo = (lote: NormalizedTransaction[]) => ({
  owner,
  fuente: 'nequi' as const,
  nombreFuente: 'Nequi',
  lote,
  capturadoEn: '2026-08-27T21:00:00.000-05:00',
});

describe('splitObservation', () => {
  it('convierte una observación fusionada en transacción propia, con su crudo', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    await ingestNormalized(d, porCorreo([correo]));
    const delCorreo = mustExist(d.ingest.observations().find((o) => o.fuente === 'nequi'));

    const nuevoId = await splitObservation(d, { owner, observationId: delCorreo.id });

    expect(d.transactions.all()).toHaveLength(2);
    const nueva = mustExist(await d.transactions.findById(nuevoId));
    expect(nueva.descripcion).toBe('Pago en EXITO SUR');
    expect(nueva.origen.fuente).toBe('nequi');
    // La observación ahora apunta a la nueva transacción, y la original se queda con la suya.
    expect(d.ingest.observations().find((o) => o.fuente === 'nequi')?.transactionId).toBe(nuevoId);
    expect(d.ingest.observations().find((o) => o.fuente === 'bancolombia')?.transactionId).toBe(
      'bancolombia:REF-1',
    );
  });

  it('el nuevo id es el determinista de esa fuente y referencia', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    await ingestNormalized(d, porCorreo([correo]));
    const delCorreo = mustExist(d.ingest.observations().find((o) => o.fuente === 'nequi'));

    const nuevoId = await splitObservation(d, { owner, observationId: delCorreo.id });

    expect(nuevoId).toBe(`nequi:${String(delCorreo.referencia)}`);
  });

  it('separar la única observación de una transacción no tiene sentido y falla', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    const unica = mustExist(d.ingest.observations()[0]);

    await expect(splitObservation(d, { owner, observationId: unica.id })).rejects.toThrow(/única/);
  });

  it('falla si la observación no existe o es de otro propietario', async () => {
    const d = deps();
    await expect(splitObservation(d, { owner, observationId: 'nada' })).rejects.toThrow(/nada/);
    await ingestNormalized(d, porWeb([web]));
    await ingestNormalized(d, porCorreo([correo]));
    const delCorreo = mustExist(d.ingest.observations().find((o) => o.fuente === 'nequi'));
    await expect(
      splitObservation(d, { owner: ownerId('otro'), observationId: delCorreo.id }),
    ).rejects.toThrow(/No existe/);
  });

  it('la transacción separada no vuelve a fusionarse sola al reprocesar', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    await ingestNormalized(d, porCorreo([correo]));
    const delCorreo = mustExist(d.ingest.observations().find((o) => o.fuente === 'nequi'));
    await splitObservation(d, { owner, observationId: delCorreo.id });

    const resumen = await ingestNormalized(d, porCorreo([correo]));

    expect(resumen).toMatchObject({ duplicadas: 1, fusionadas: 0, nuevas: 0 });
    expect(d.transactions.all()).toHaveLength(2);
  });
});

describe('mergeTransactions', () => {
  it('mueve las observaciones de una a la otra y borra la absorbida', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    // Monto distinto: no se emparejó sola.
    await ingestNormalized(d, porCorreo([{ ...correo, monto: 45500 }]));
    const [a, b] = d.transactions.all().map((t) => t.id);
    // Para fusionar a mano, primero se iguala el monto de prueba.
    await ingestNormalized(d, porCorreo([{ ...correo, fecha: '2026/08/20' }]));
    const [, , c] = d.transactions.all().map((t) => t.id);
    void b;

    await mergeTransactions(d, { owner, keep: mustExist(a), absorb: mustExist(c) });

    expect(d.transactions.all()).toHaveLength(2);
    const deKeep = d.ingest.observations().filter((o) => o.transactionId === a);
    expect(deKeep.map((o) => o.fuente).sort()).toEqual(['bancolombia', 'nequi']);
  });

  it('es la inversa de splitObservation', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    await ingestNormalized(d, porCorreo([correo]));
    const delCorreo = mustExist(d.ingest.observations().find((o) => o.fuente === 'nequi'));
    const separada = await splitObservation(d, { owner, observationId: delCorreo.id });

    await mergeTransactions(d, {
      owner,
      keep: transactionId('bancolombia:REF-1'),
      absorb: separada,
    });

    expect(d.transactions.all()).toHaveLength(1);
    expect(d.ingest.observations().map((o) => o.transactionId)).toEqual([
      'bancolombia:REF-1',
      'bancolombia:REF-1',
    ]);
  });

  it('rechaza fusionar dos transacciones que la misma fuente vio por separado', async () => {
    // Dos referencias distintas de Bancolombia son dos compras: fusionarlas
    // perdería dinero del saldo.
    const d = deps();
    await ingestNormalized(d, porWeb([web, { ...web, referencia: 'REF-2' }]));

    await expect(
      mergeTransactions(d, {
        owner,
        keep: transactionId('bancolombia:REF-1'),
        absorb: transactionId('bancolombia:REF-2'),
      }),
    ).rejects.toThrow(/misma fuente/);
  });

  it('rechaza fusionar montos distintos', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    await ingestNormalized(d, porCorreo([{ ...correo, monto: 1 }]));
    const [a, b] = d.transactions.all().map((t) => t.id);

    await expect(
      mergeTransactions(d, { owner, keep: mustExist(a), absorb: mustExist(b) }),
    ).rejects.toThrow(/monto/);
  });

  it('falla con ids desconocidos', async () => {
    const d = deps();
    await expect(
      mergeTransactions(d, { owner, keep: transactionId('x'), absorb: transactionId('y') }),
    ).rejects.toThrow(/"x"/);
  });
});
