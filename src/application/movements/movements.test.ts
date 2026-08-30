import { ownerId, transactionId } from '@/domain/ledger/ids';
import { sourceAccountId, systemAccountId } from '@/domain/ledger/system-accounts';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';
import { mustExist } from '@/test/must-exist';

import { detectTransfers } from '../ingest/detect-transfers';
import { ingestNormalized } from '../ingest/ingest-normalized';
import type { IngestDeps } from '../ingest/types';
import { getMovement, listMovements } from './movements';

const owner = ownerId('david');

function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const d: IngestDeps = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    ids: createSequentialIds('id'),
    clock: () => '2026-08-28T12:00:00.000-05:00',
  };
  return { ...d, accounts, transactions };
}

async function sembrar(d: ReturnType<typeof deps>) {
  await ingestNormalized(d, {
    owner,
    fuente: 'bancolombia',
    nombreFuente: 'Bancolombia',
    capturadoEn: '2026-08-28T10:00:00.000-05:00',
    lote: [
      {
        fecha: '2026/08/28',
        descripcion: 'COMPRA EXITO',
        monto: 45000,
        moneda: 'COP',
        tipo: 'debito',
        fuente: 'bancolombia',
        referencia: 'C1',
      },
      {
        fecha: '2026/08/27',
        descripcion: 'TRANSFERENCIA A NEQUI',
        monto: 200000,
        moneda: 'COP',
        tipo: 'debito',
        fuente: 'bancolombia',
        referencia: 'T1',
      },
      {
        fecha: '2026/08/26',
        descripcion: 'ABONO NOMINA',
        monto: 1000000,
        moneda: 'COP',
        tipo: 'credito',
        fuente: 'bancolombia',
        referencia: 'N1',
      },
    ],
  });
  await ingestNormalized(d, {
    owner,
    fuente: 'nequi',
    nombreFuente: 'Nequi',
    capturadoEn: '2026-08-28T09:00:00.000-05:00',
    lote: [
      {
        fecha: '2026/08/28',
        descripcion: 'Te llegó plata',
        monto: 200000,
        moneda: 'COP',
        tipo: 'credito',
        fuente: 'nequi',
        referencia: 'R1',
      },
    ],
  });
  await detectTransfers(d, { owner });
}

describe('listMovements', () => {
  it('una compra sale de la cuenta hacia sin clasificar', async () => {
    const d = deps();
    await sembrar(d);
    const compra = mustExist(
      (await listMovements(d, { owner })).items.find((m) => m.id === 'bancolombia:C1'),
    );

    expect(compra.direction).toBe('sale');
    expect(compra.monto.amount).toBe(45000n);
    expect(compra.cuenta.id).toBe(sourceAccountId('bancolombia'));
    expect(compra.contraparte?.id).toBe(systemAccountId('gastos-sin-clasificar'));
    expect(compra.sinClasificar).toBe(true);
    expect(compra.esTransferencia).toBe(false);
    expect(compra.fuente).toBe('bancolombia');
  });

  it('un abono entra', async () => {
    const d = deps();
    await sembrar(d);
    const abono = mustExist(
      (await listMovements(d, { owner })).items.find((m) => m.id === 'bancolombia:N1'),
    );
    expect(abono.direction).toBe('entra');
    expect(abono.monto.amount).toBe(1000000n);
  });

  it('una transferencia fundida aparece una sola vez, neutra, con origen y destino', async () => {
    const d = deps();
    await sembrar(d);
    const { items } = await listMovements(d, { owner });

    expect(items).toHaveLength(3);
    const transferencia = mustExist(items.find((m) => m.esTransferencia));
    expect(transferencia.direction).toBe('neutro');
    expect(transferencia.cuenta.id).toBe(sourceAccountId('bancolombia'));
    expect(transferencia.contraparte?.id).toBe(sourceAccountId('nequi'));
    expect(transferencia.sinClasificar).toBe(false);
  });

  it('el filtro por cuenta devuelve las dos caras de la transferencia', async () => {
    const d = deps();
    await sembrar(d);
    const enNequi = await listMovements(d, { owner, accountId: sourceAccountId('nequi') });
    expect(enNequi.items.map((m) => m.id)).toEqual(['bancolombia:T1']);
  });

  it('pagina por cursor en orden descendente', async () => {
    const d = deps();
    await sembrar(d);
    const primera = await listMovements(d, { owner, limit: 2 });
    expect(primera.items).toHaveLength(2);
    expect(primera.nextCursor).not.toBeNull();
    const segunda = await listMovements(d, {
      owner,
      limit: 2,
      cursor: primera.nextCursor ?? undefined,
    });
    expect(segunda.items).toHaveLength(1);
    expect(segunda.nextCursor).toBeNull();
  });
});

describe('getMovement', () => {
  it('devuelve la vista, la transacción, las cuentas, quién la vio y el registro de transferencia', async () => {
    const d = deps();
    await sembrar(d);
    const detalle = mustExist(await getMovement(d, { owner, id: transactionId('bancolombia:T1') }));

    expect(detalle.vista.esTransferencia).toBe(true);
    expect(detalle.transaccion.postings).toHaveLength(2);
    expect(detalle.cuentas.size).toBe(2);
    expect(detalle.observaciones.map((o) => o.fuente)).toEqual(['bancolombia']);
    expect(mustExist(detalle.transferencia).estado).toBe('detectada');
  });

  it('una compra no tiene registro de transferencia', async () => {
    const d = deps();
    await sembrar(d);
    expect(
      mustExist(await getMovement(d, { owner, id: transactionId('bancolombia:C1') })).transferencia,
    ).toBeNull();
  });

  it('es null para un id ajeno o inexistente', async () => {
    const d = deps();
    await sembrar(d);
    expect(
      await getMovement(d, { owner: ownerId('otro'), id: transactionId('bancolombia:C1') }),
    ).toBeNull();
    expect(await getMovement(d, { owner, id: transactionId('nada') })).toBeNull();
  });
});
