import type { Capture } from '@/domain/capture/reassembler';
import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createFakeServerClient } from '@/test/fakes/fake-server-client';
import { createInMemoryBatchRepository } from '@/test/fakes/in-memory-batch-repository';
import { createInMemoryCategoryRepository } from '@/test/fakes/in-memory-category-repository';
import { createInMemoryClassificationRepository } from '@/test/fakes/in-memory-classification-repository';
import { createInMemoryEvidenceRepository } from '@/test/fakes/in-memory-evidence-repository';
import { createInMemoryRuleRepository } from '@/test/fakes/in-memory-rule-repository';
import { createInMemorySyncStateRepository } from '@/test/fakes/in-memory-sync-state-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';
import { createInMemoryCardRepository } from '@/test/fakes/in-memory-card-repository';
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
    categories: createInMemoryCategoryRepository(),
    classifications: createInMemoryClassificationRepository(),
    rules: createInMemoryRuleRepository(),
    evidence: createInMemoryEvidenceRepository(),
    batches: createInMemoryBatchRepository(),
    servidor: createFakeServerClient([]),
    sync: createInMemorySyncStateRepository(),
    cards: createInMemoryCardRepository(),
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
      canal: 'web' as const,
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

    // La nómina del 27 es anterior al inicio (28): no entra.
    expect(resumen).toMatchObject({
      capturas: 2,
      extraidas: 3,
      nuevas: 2,
      anteriores: 1,
      transferencias: 1,
      // La compra en Éxito sale por catálogo; la transferencia no se clasifica.
      clasificadas: 1,
      porRevisar: 0,
    });
    expect((await d.accounts.balanceOf(categoryAccountId('mercado'))).amount).toBe(45000n);
    // Conciliado DESPUÉS de ingerir y del saldo inicial: el calculado incluye
    // lo recién entrado y lo que había antes, y cuadra con el banco.
    const c = mustExist(resumen.conciliacion);
    expect(c.saldoReal.amount).toBe(700000n);
    expect(c.saldoCalculado.amount).toBe(700000n);
    expect(c.veredicto).toBe('cuadra');
    expect(resumen.saldoInicial?.amount).toBe(700000n - (-45000n - 200000n));
  });

  it('en la primera sincronización fija el saldo inicial y la cuenta queda como en el banco', async () => {
    // Lo encontró David en la sesión de campo: sin esto, Bancolombia quedaba
    // en negativo, porque el ledger solo conocía los movimientos capturados.
    const d = deps();
    const resumen = await syncPortal(d, {
      owner,
      portalId: 'bancolombia',
      captures: [movimientos, saldos],
    });

    expect(resumen.saldoInicial?.amount).toBe(700000n - (-45000n - 200000n));
    expect((await d.accounts.balanceOf(accountId('bancolombia:ahorros'))).amount).toBe(700000n);
    expect(resumen.conciliacion?.veredicto).toBe('cuadra');
    const apertura = d.transactions.all().find((t) => t.origen.fuente === 'manual');
    expect(apertura?.descripcion).toMatch(/Saldo inicial al 2026-08-28/);
  });

  it('en la segunda sincronización no vuelve a fijar saldo inicial: una diferencia ya es real', async () => {
    const d = deps();
    await syncPortal(d, { owner, portalId: 'bancolombia', captures: [movimientos, saldos] });

    // El banco ahora declara 5.000 menos, sin movimiento nuevo que lo explique.
    const saldosMenos = {
      ...saldos,
      id: 'saldos-2',
      capturedAt: '2026-08-29T10:00:00.000-05:00',
      body: saldos.body.replace('700000', '695000'),
    };
    const segunda = await syncPortal(d, {
      owner,
      portalId: 'bancolombia',
      captures: [movimientos, saldosMenos],
    });

    expect(segunda.saldoInicial).toBeNull();
    expect(segunda.conciliacion?.veredicto).toBe('gasto-no-capturado');
    expect(segunda.conciliacion?.diferencia.amount).toBe(-5000n);
    expect(d.transactions.all().filter((t) => t.origen.fuente === 'manual')).toHaveLength(1);
  });

  it('una instalación que ya concilió sin cuadrar (antes de existir el saldo inicial) lo recibe al reimportar', async () => {
    const d = deps();
    await d.reconciliations.save({
      id: 'rec-vieja',
      owner,
      accountId: accountId('bancolombia:ahorros'),
      fecha: '2026-08-27T18:00:00.000-05:00',
      saldoReal: money(700000, 'COP'),
      saldoCalculado: money(-35000, 'COP'),
      diferencia: money(735000, 'COP'),
      veredicto: 'ingreso-no-capturado',
      fuente: 'bancolombia',
      detalle: 'Ahorros ****8901',
      creadoEn: '2026-08-27T18:00:00.000-05:00',
    });

    const resumen = await syncPortal(d, {
      owner,
      portalId: 'bancolombia',
      captures: [movimientos, saldos],
    });

    expect(resumen.saldoInicial).not.toBeNull();
    expect((await d.accounts.balanceOf(accountId('bancolombia:ahorros'))).amount).toBe(700000n);
    expect((await d.reconciliations.findLatest(accountId('bancolombia:ahorros')))?.veredicto).toBe(
      'cuadra',
    );
  });

  it('si la primera sincronización ya cuadra, no asienta un saldo inicial de cero', async () => {
    const d = deps();
    // Un solo abono del día de inicio y un saldo del banco que es exactamente ese abono.
    const soloAbono = captura(`${HOST}/account/transactions`, {
      data: {
        transactions: [
          {
            transactionDate: '2026/08/28',
            description: 'ABONO',
            amount: 50000,
            type: 'DEBITO',
            reference1: 'A1',
          },
        ],
      },
    });
    const saldosExactos = { ...saldos, body: saldos.body.replace('700000', '50000') };
    const resumen = await syncPortal(d, {
      owner,
      portalId: 'bancolombia',
      captures: [soloAbono, saldosExactos],
    });

    expect(resumen.saldoInicial).toBeNull();
    expect(d.transactions.all().some((t) => t.origen.fuente === 'manual')).toBe(false);
  });

  it('sin captura de saldos, la conciliación es null y lo demás funciona', async () => {
    const d = deps();
    const resumen = await syncPortal(d, {
      owner,
      portalId: 'bancolombia',
      captures: [movimientos],
    });
    expect(resumen.conciliacion).toBeNull();
    expect(resumen.nuevas).toBe(2);
  });

  it('es idempotente de punta a punta', async () => {
    const d = deps();
    await syncPortal(d, { owner, portalId: 'bancolombia', captures: [movimientos, saldos] });
    const segunda = await syncPortal(d, {
      owner,
      portalId: 'bancolombia',
      captures: [movimientos, saldos],
    });

    expect(segunda).toMatchObject({
      nuevas: 0,
      duplicadas: 2,
      anteriores: 1,
      transferencias: 0,
      saldoInicial: null,
    });
    // 2 movimientos + 1 saldo inicial de la primera vez; la segunda no añade nada.
    expect(d.transactions.all()).toHaveLength(3);
  });
});
