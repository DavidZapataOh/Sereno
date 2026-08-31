import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { mustExist } from '@/test/must-exist';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import { getOverview } from './get-overview';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const tarjeta = accountId('nu:tarjeta');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  await accounts.save(
    createAccount({ id: tarjeta, owner, kind: 'pasivo', nombre: 'Nu', currency: 'COP' }),
  );
  return {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    reconciliations: createInMemoryReconciliationRepository(),
  };
}

const tx = (id: string, apuntes: [string, number][]) =>
  createTransaction({
    id: transactionId(id),
    owner,
    fecha: '2026-08-28T00:00:00.000-05:00',
    descripcion: id,
    origen: { fuente: 'p', referencia: id },
    postings: apuntes.map(([cuenta, monto]) => ({
      accountId: accountId(cuenta),
      amount: money(monto, 'COP'),
    })),
  });

describe('getOverview', () => {
  it('el patrimonio es activos menos pasivos', async () => {
    const d = await deps();
    await d.transactions.save(
      tx('nomina', [
        [banco, 1000000],
        ['sistema:ingresos-sin-clasificar', -1000000],
      ]),
    );
    await d.transactions.save(
      tx('compra-tarjeta', [
        [tarjeta, -300000],
        ['sistema:gastos-sin-clasificar', 300000],
      ]),
    );

    expect((await getOverview(d, owner)).patrimonio).toEqual(money(700000, 'COP'));
  });

  it('lista las cuentas reales con saldo, incluido el efectivo, y no las de sistema contables', async () => {
    const d = await deps();
    const ids = (await getOverview(d, owner)).cuentas.map((c) => c.account.id);

    expect(ids).toContain(banco);
    expect(ids).toContain(tarjeta);
    expect(ids).toContain(systemAccountId('efectivo'));
    expect(ids).not.toContain(systemAccountId('gastos-sin-clasificar'));
    expect(ids).not.toContain(systemAccountId('ajustes'));
  });

  it('expone cuánto hay sin clasificar, en positivo', async () => {
    const d = await deps();
    await d.transactions.save(
      tx('compra', [
        [banco, -45000],
        ['sistema:gastos-sin-clasificar', 45000],
      ]),
    );
    await d.transactions.save(
      tx('abono', [
        [banco, 90000],
        ['sistema:ingresos-sin-clasificar', -90000],
      ]),
    );

    const o = await getOverview(d, owner);
    expect(o.sinClasificar.gastos).toEqual(money(45000, 'COP'));
    expect(o.sinClasificar.ingresos).toEqual(money(90000, 'COP'));
  });

  it('sin corridas no hay última sincronización; con varias, la más reciente entre fuentes', async () => {
    const d = await deps();
    expect((await getOverview(d, owner)).ultimaSincronizacion).toBeNull();

    const base = {
      owner,
      terminadoEn: null,
      capturas: 0,
      extraidas: 0,
      nuevas: 0,
      duplicadas: 0,
      fusionadas: 0,
      omitidas: 0,
      anteriores: 0,
      transferencias: 0,
      error: null,
    };
    await d.ingest.saveRun({
      ...base,
      id: 'b',
      fuente: 'bancolombia',
      iniciadoEn: '2026-08-20T10:00:00.000-05:00',
    });
    await d.ingest.saveRun({
      ...base,
      id: 'n',
      fuente: 'nequi',
      iniciadoEn: '2026-08-27T10:00:00.000-05:00',
    });

    expect(mustExist((await getOverview(d, owner)).ultimaSincronizacion).id).toBe('n');
  });

  it('la conciliación es la más reciente entre todas las cuentas', async () => {
    const d = await deps();
    const base = {
      owner,
      saldoReal: money(1, 'COP'),
      saldoCalculado: money(1, 'COP'),
      diferencia: money(0, 'COP'),
      veredicto: 'cuadra' as const,
      fuente: 'x',
      detalle: '',
    };
    await d.reconciliations.save({
      ...base,
      id: 'vieja',
      accountId: banco,
      fecha: '2026-08-20T10:00:00.000-05:00',
      creadoEn: '2026-08-20T10:00:00.000-05:00',
    });
    await d.reconciliations.save({
      ...base,
      id: 'nueva',
      accountId: tarjeta,
      fecha: '2026-08-27T10:00:00.000-05:00',
      creadoEn: '2026-08-27T10:00:00.000-05:00',
    });

    expect(mustExist((await getOverview(d, owner)).conciliacion).id).toBe('nueva');
  });

  it('con otro propietario no ve nada', async () => {
    const d = await deps();
    const o = await getOverview(d, ownerId('otro'));
    expect(o.cuentas).toEqual([]);
    expect(o.patrimonio).toEqual(money(0, 'COP'));
  });
});

/**
 * Antes del sprint 08, `getOverview` filtraba `c.currency === 'COP'`: una
 * cuenta en USDC no aparecía ni en la lista ni en el patrimonio, y no había
 * forma de notarlo salvo echarla de menos.
 */
describe('cuentas en otra moneda', () => {
  const wallet = accountId('wallet:solana');

  async function conWallet() {
    const d = await deps();
    await d.accounts.save(
      createAccount({ id: wallet, owner, kind: 'activo', nombre: 'Solana', currency: 'USDC' }),
    );
    await d.transactions.save(
      createTransaction({
        id: transactionId('saldo-wallet'),
        owner,
        fecha: '2026-08-31T10:00:00.000-05:00',
        descripcion: 'Saldo leído de la cadena',
        origen: { fuente: 'manual', referencia: null },
        postings: [
          // El saldo real de Solana medido el 2026-08-31.
          { accountId: wallet, amount: money(85_761n, 'USDC') },
          { accountId: systemAccountId('ajustes'), amount: money(-85_761n, 'USDC') },
        ],
      }),
    );
    return d;
  }

  it('una cuenta en USDC aparece en la lista', async () => {
    const overview = await getOverview(await conWallet(), owner);

    expect(overview.cuentas.map((c) => c.account.currency)).toContain('USDC');
  });

  /**
   * Lo que no se pudo valorar se declara y **no se suma como cero**: un total
   * que calla lo que no supo valorar miente por omisión, y se ve bien.
   */
  it('lo que no está en pesos se lista aparte y no se suma al patrimonio', async () => {
    const overview = await getOverview(await conWallet(), owner);

    expect(overview.sinValorar).toHaveLength(1);
    expect(overview.sinValorar[0]?.saldo.amount).toBe(85_761n);
    expect(overview.patrimonio.currency).toBe('COP');
  });

  it('el patrimonio sigue siendo la suma de lo que sí está en pesos', async () => {
    const d = await conWallet();

    const overview = await getOverview(d, owner);

    const enPesos = overview.cuentas
      .filter((c) => c.account.currency === 'COP')
      .reduce((s, c) => s + c.saldo.amount, 0n);
    expect(overview.patrimonio.amount).toBe(enPesos);
  });
});
