import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';
import { mustExist } from '@/test/must-exist';

import { detectTransfers } from './detect-transfers';
import { ingestNormalized } from './ingest-normalized';
import { confirmTransfer, undoTransfer } from './resolve-transfer';
import type { IngestDeps } from './types';

const owner = ownerId('david');

function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const ingest = createInMemoryIngestRepository();
  const transfers = createInMemoryTransferRepository();
  const d: IngestDeps = {
    accounts,
    transactions,
    ingest,
    transfers,
    ids: createSequentialIds('id'),
    clock: () => '2026-08-28T10:00:00.000-05:00',
  };
  return { ...d, accounts, transactions, ingest, transfers };
}

const envio: NormalizedTransaction = {
  fecha: '2026/08/10',
  descripcion: 'TRANSFERENCIA A NEQUI',
  monto: 200000,
  moneda: 'COP',
  tipo: 'debito',
  fuente: 'bancolombia',
  referencia: 'ENV-1',
};
const recibo: NormalizedTransaction = {
  fecha: '2026/08/11',
  descripcion: 'Te llegó plata',
  monto: 200000,
  moneda: 'COP',
  tipo: 'credito',
  fuente: 'nequi',
  referencia: 'REC-1',
};

async function sembrar(d: ReturnType<typeof deps>, envioReal: NormalizedTransaction = envio) {
  await ingestNormalized(d, {
    owner,
    fuente: 'bancolombia',
    nombreFuente: 'Bancolombia',
    lote: [envioReal],
    capturadoEn: '2026-08-10T10:00:00.000-05:00',
  });
  await ingestNormalized(d, {
    owner,
    fuente: 'nequi',
    nombreFuente: 'Nequi',
    lote: [recibo],
    capturadoEn: '2026-08-11T10:00:00.000-05:00',
  });
}

const saldo = async (d: ReturnType<typeof deps>, id: string) =>
  (await d.accounts.balanceOf(accountId(id))).amount;

describe('detectTransfers', () => {
  it('funde el envío y el recibo en una transferencia, sin gasto ni ingreso', async () => {
    const d = deps();
    await sembrar(d);
    expect(await saldo(d, 'sistema:gastos-sin-clasificar')).toBe(200000n);

    const resultado = await detectTransfers(d, { owner });

    expect(resultado.detectadas).toBe(1);
    expect(d.transactions.all()).toHaveLength(1);
    expect(await saldo(d, 'sistema:gastos-sin-clasificar')).toBe(0n);
    expect(await saldo(d, 'sistema:ingresos-sin-clasificar')).toBe(0n);
    expect(await saldo(d, 'bancolombia:ahorros')).toBe(-200000n);
    expect(await saldo(d, 'nequi:ahorros')).toBe(200000n);
  });

  it('deja un registro detectado con las instantáneas y las observaciones de la entrada', async () => {
    const d = deps();
    await sembrar(d);
    await detectTransfers(d, { owner });

    const registro = mustExist(d.transfers.all()[0]);
    expect(registro.estado).toBe('detectada');
    expect(registro.salida.id).toBe('bancolombia:ENV-1');
    expect(registro.entrada.id).toBe('nequi:REC-1');
    expect(registro.observacionesEntrada.map((o) => o.fuente)).toEqual(['nequi']);
    // La observación de la entrada ya no cuelga de una transacción viva.
    expect(d.ingest.observations().map((o) => o.transactionId)).toEqual(['bancolombia:ENV-1']);
  });

  it('es idempotente: correrlo de nuevo no detecta nada', async () => {
    const d = deps();
    await sembrar(d);
    await detectTransfers(d, { owner });
    expect((await detectTransfers(d, { owner })).detectadas).toBe(0);
  });

  it('no empareja un recibo con un envío de otro monto', async () => {
    const d = deps();
    await sembrar(d, { ...envio, monto: 150000 });

    expect((await detectTransfers(d, { owner })).detectadas).toBe(0);
    expect(d.transactions.all()).toHaveLength(2);
  });

  it('el ledger sigue cuadrando después de detectar', async () => {
    const d = deps();
    await sembrar(d);
    await detectTransfers(d, { owner });
    const saldos = await Promise.all(d.accounts.all().map((c) => d.accounts.balanceOf(c.id)));
    expect(saldos.reduce((acc, s) => acc + s.amount, 0n)).toBe(0n);
  });
});

describe('confirmTransfer', () => {
  it('marca el registro como confirmado', async () => {
    const d = deps();
    await sembrar(d);
    await detectTransfers(d, { owner });
    const id = mustExist(d.transfers.all()[0]).id;

    await confirmTransfer(d, { owner, transferId: id });

    const r = mustExist(await d.transfers.findById(id));
    expect(r.estado).toBe('confirmada');
    expect(r.resueltaEn).not.toBeNull();
  });
});

describe('undoTransfer', () => {
  it('restaura las dos transacciones originales y sus observaciones', async () => {
    const d = deps();
    await sembrar(d);
    await detectTransfers(d, { owner });
    const id = mustExist(d.transfers.all()[0]).id;

    await undoTransfer(d, { owner, transferId: id });

    expect(
      d.transactions
        .all()
        .map((t) => t.id)
        .sort(),
    ).toEqual(['bancolombia:ENV-1', 'nequi:REC-1']);
    expect(await saldo(d, 'sistema:gastos-sin-clasificar')).toBe(200000n);
    expect(await saldo(d, 'sistema:ingresos-sin-clasificar')).toBe(-200000n);
    expect(
      d.ingest
        .observations()
        .map((o) => o.transactionId)
        .sort(),
    ).toEqual(['bancolombia:ENV-1', 'nequi:REC-1']);
    expect(mustExist(await d.transfers.findById(id)).estado).toBe('deshecha');
  });

  it('un par deshecho no se vuelve a detectar', async () => {
    const d = deps();
    await sembrar(d);
    await detectTransfers(d, { owner });
    await undoTransfer(d, { owner, transferId: mustExist(d.transfers.all()[0]).id });

    expect((await detectTransfers(d, { owner })).detectadas).toBe(0);
    expect(d.transactions.all()).toHaveLength(2);
  });

  it('no se puede deshacer dos veces', async () => {
    const d = deps();
    await sembrar(d);
    await detectTransfers(d, { owner });
    const id = mustExist(d.transfers.all()[0]).id;
    await undoTransfer(d, { owner, transferId: id });

    await expect(undoTransfer(d, { owner, transferId: id })).rejects.toThrow(/deshecha/);
    await expect(confirmTransfer(d, { owner, transferId: id })).rejects.toThrow(/deshecha/);
  });

  it('falla con un id desconocido o de otro propietario', async () => {
    const d = deps();
    await expect(undoTransfer(d, { owner, transferId: 'nada' })).rejects.toThrow(/nada/);
    await sembrar(d);
    await detectTransfers(d, { owner });
    const id = mustExist(d.transfers.all()[0]).id;
    await expect(undoTransfer(d, { owner: ownerId('otro'), transferId: id })).rejects.toThrow(
      /No existe/,
    );
  });
});
