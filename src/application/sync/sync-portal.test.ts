import type { Capture } from '@/domain/capture/reassembler';
import { ownerId } from '@/domain/ledger/ids';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';
import { mustExist } from '@/test/must-exist';

import { ingestNormalized } from '../ingest/ingest-normalized';
import { syncPortal, type AppDeps } from './sync-portal';

const owner = ownerId('david');
const HOST =
  'https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ch-ms-deposits';

function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const d: AppDeps = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    reconciliations: createInMemoryReconciliationRepository(),
    ids: createSequentialIds('id'),
    clock: () => '2026-08-28T12:00:00.000-05:00',
  };
  return { ...d, accounts, transactions };
}

const captura = (
  url: string,
  body: unknown,
  capturedAt = '2026-08-28T10:00:00.000-05:00',
): Capture => ({
  id: url,
  url,
  method: 'GET',
  status: 200,
  contentType: 'application/json',
  kind: 'fetch',
  capturedAt,
  body: JSON.stringify(body),
});
const movimientos = captura(`${HOST}/account/transactions`, {
  data: {
    transactions: [
      {
        transactionDate: '2026/08/27',
        description: 'ABONO NOMINA',
        amount: 1000000,
        type: 'DEBITO',
        reference1: 'N1',
      },
      {
        transactionDate: '2026/08/28',
        description: 'COMPRA EXITO',
        amount: -45000,
        type: 'CREDITO',
        reference1: 'C1',
      },
      {
        transactionDate: '2026/08/28',
        description: 'TRANSFERENCIA A NEQUI',
        amount: -200000,
        type: 'CREDITO',
        reference1: 'T1',
      },
    ],
  },
});
const saldos = captura(`${HOST}/hybrid/accounts/customization/consolidated`, {
  data: {
    accounts: [
      { number: '12345678901', name: 'Ahorros', currency: 'COP', balances: { available: 700000 } },
    ],
  },
});

describe('syncPortal', () => {
  it('ingiere, concilia y detecta transferencias, en ese orden, y lo resume', async () => {
    const d = deps();
    // La otra cara de la transferencia ya estaba, traída por correo (sprint 06).
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

    const resumen = await syncPortal(d, {
      owner,
      portalId: 'bancolombia',
      captures: [movimientos, saldos],
    });

    expect(resumen).toMatchObject({ capturas: 2, extraidas: 3, nuevas: 3, transferencias: 1 });
    // Conciliado DESPUÉS de ingerir: el calculado incluye lo recién entrado.
    const c = mustExist(resumen.conciliacion);
    expect(c.saldoCalculado.amount).toBe(1000000n - 45000n - 200000n);
    expect(c.saldoReal.amount).toBe(700000n);
    expect(c.veredicto).toBe('gasto-no-capturado');
    expect(c.diferencia.amount).toBe(-55000n);
  });

  it('sin captura de saldos, la conciliación es null y lo demás funciona', async () => {
    const d = deps();
    const resumen = await syncPortal(d, {
      owner,
      portalId: 'bancolombia',
      captures: [movimientos],
    });
    expect(resumen.conciliacion).toBeNull();
    expect(resumen.nuevas).toBe(3);
  });

  it('es idempotente de punta a punta', async () => {
    const d = deps();
    await syncPortal(d, { owner, portalId: 'bancolombia', captures: [movimientos, saldos] });
    const segunda = await syncPortal(d, {
      owner,
      portalId: 'bancolombia',
      captures: [movimientos, saldos],
    });

    expect(segunda).toMatchObject({ nuevas: 0, duplicadas: 3, transferencias: 0 });
    expect(d.transactions.all()).toHaveLength(3);
  });
});
