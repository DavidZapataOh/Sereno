import type { Capture } from '@/domain/capture/reassembler';
import { createAccount } from '@/domain/ledger/account';
import { ownerId, transactionId } from '@/domain/ledger/ids';
import { sourceAccountId, systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';
import { mustExist } from '@/test/must-exist';

import { reconcileAccount, type ReconciliationDeps } from './reconcile-account';
import { reconcileFromCaptures } from './reconcile-from-captures';

const owner = ownerId('david');
const ahorros = sourceAccountId('bancolombia');
const URL_SALDOS =
  'https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ch-ms-deposits/hybrid/accounts/customization/consolidated';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  await accounts.save(
    createAccount({
      id: systemAccountId('ingresos-sin-clasificar'),
      owner,
      kind: 'ingreso',
      nombre: 'I',
      currency: 'COP',
    }),
  );
  // Un abono de 1.000.000 el día 20.
  await transactions.save(
    createTransaction({
      id: transactionId('t1'),
      owner,
      fecha: '2026-08-20T00:00:00.000-05:00',
      descripcion: 'NOMINA',
      origen: { fuente: 'bancolombia', referencia: 'N' },
      postings: [
        { accountId: ahorros, amount: money(1000000, 'COP') },
        { accountId: systemAccountId('ingresos-sin-clasificar'), amount: money(-1000000, 'COP') },
      ],
    }),
  );
  const reconciliations = createInMemoryReconciliationRepository();
  const d: ReconciliationDeps = {
    accounts,
    reconciliations,
    ids: createSequentialIds('rec'),
    clock: () => '2026-08-28T10:00:00.000-05:00',
  };
  return { ...d, accounts, transactions, reconciliations };
}

const base = { fuente: 'bancolombia', detalle: 'Ahorros ****8901' };

describe('reconcileAccount', () => {
  it('guarda la conciliación con los tres números y el veredicto', async () => {
    const d = await deps();
    const r = await reconcileAccount(d, {
      owner,
      accountId: ahorros,
      saldoReal: money(955000, 'COP'),
      fecha: '2026-08-28T10:00:00.000-05:00',
      ...base,
    });

    expect(r.saldoCalculado.amount).toBe(1000000n);
    expect(r.saldoReal.amount).toBe(955000n);
    expect(r.diferencia.amount).toBe(-45000n);
    expect(r.veredicto).toBe('gasto-no-capturado');
    expect(mustExist(await d.reconciliations.findLatest(ahorros)).id).toBe(r.id);
  });

  it('calcula el saldo a la fecha pedida, no el actual', async () => {
    const d = await deps();
    const r = await reconcileAccount(d, {
      owner,
      accountId: ahorros,
      saldoReal: money(0, 'COP'),
      fecha: '2026-08-19T23:59:59.999-05:00',
      ...base,
    });
    expect(r.saldoCalculado.amount).toBe(0n);
    expect(r.veredicto).toBe('cuadra');
  });

  it('falla si la cuenta no existe o no es del propietario', async () => {
    const d = await deps();
    await expect(
      reconcileAccount(d, {
        owner: ownerId('otro'),
        accountId: ahorros,
        saldoReal: money(0, 'COP'),
        fecha: '2026-08-28T10:00:00.000-05:00',
        ...base,
      }),
    ).rejects.toThrow(/cuenta/);
  });
});

describe('reconcileFromCaptures', () => {
  const consolidado = (
    available: number,
    capturedAt = '2026-08-28T10:00:00.000-05:00',
  ): Capture => ({
    id: `c-${capturedAt}`,
    method: 'GET',
    status: 200,
    contentType: 'application/json',
    kind: 'fetch',
    url: URL_SALDOS,
    capturedAt,
    body: JSON.stringify({
      data: {
        accounts: [
          {
            number: '12345678901',
            name: 'Ahorros',
            type: 'CUENTA_AHORRO',
            currency: 'COP',
            balances: { available },
          },
        ],
      },
    }),
  });

  it('concilia la cuenta de la fuente con el saldo capturado, a la hora de la captura', async () => {
    const d = await deps();
    const [r] = await reconcileFromCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [consolidado(955000)],
    });

    expect(mustExist(r).accountId).toBe(ahorros);
    expect(mustExist(r).fecha).toBe('2026-08-28T10:00:00.000-05:00');
    expect(mustExist(r).veredicto).toBe('gasto-no-capturado');
    expect(mustExist(r).detalle).toBe('Ahorros ****8901');
  });

  it('sin captura de saldos no concilia nada y no falla', async () => {
    const d = await deps();
    expect(
      await reconcileFromCaptures(d, { owner, portalId: 'bancolombia', captures: [] }),
    ).toEqual([]);
  });

  it('con varias capturas de saldo usa la más reciente', async () => {
    const d = await deps();
    const [r] = await reconcileFromCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [consolidado(1, '2026-08-28T09:00:00.000-05:00'), consolidado(1000000)],
    });
    expect(mustExist(r).veredicto).toBe('cuadra');
  });

  it('para un portal sin saldo por web devuelve vacío', async () => {
    const d = await deps();
    expect(await reconcileFromCaptures(d, { owner, portalId: 'nequi', captures: [] })).toEqual([]);
  });

  it('si la cuenta de la fuente aún no existe en el ledger, no concilia', async () => {
    const d = await deps();
    await d.accounts.archive(ahorros, '2026-08-01T00:00:00.000-05:00');
    // Archivada sigue existiendo: concilia. Lo que no concilia es una que no está.
    expect(
      await reconcileFromCaptures(d, {
        owner,
        portalId: 'bancolombia',
        captures: [consolidado(1)],
      }),
    ).toHaveLength(1);
  });
});
