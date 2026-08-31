import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryRateRepository } from '@/test/fakes/in-memory-rate-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { mustExist } from '@/test/must-exist';

import { rate, type Rate } from '@/domain/rates/rate';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { convertCurrency } from '../ledger/convert-currency';
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
    rates: createInMemoryRateRepository(),
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

/**
 * El patrimonio con todo dentro, valorado en pesos.
 *
 * La prueba que importa es la primera: **la cifra es exactamente la suma de lo
 * que se enseña debajo**. David suma la lista a mano —así encontró que el
 * patrimonio negativo se mostraba sin el signo, sprint 07— y si no cuadra va a
 * tener razón.
 */
describe('patrimonio con cripto valorado', () => {
  const wallet = accountId('wallet:solana:USDC');

  const TRM = rate({
    desde: 'USD',
    hacia: 'COP',
    valor: 320_279n,
    escala: 2,
    origen: 'TRM oficial',
    momento: '2026-08-29T00:00:00.000-05:00',
  });
  const PRECIO_USDC = rate({
    desde: 'USDC',
    hacia: 'USD',
    valor: 100_018_000n,
    escala: 8,
    origen: 'Binance',
    momento: '2026-08-31T10:00:00.000-05:00',
  });

  async function conTasas(tasas: Rate[]) {
    // `convertCurrency` necesita reloj y generador de ids; el `deps` de este
    // archivo solo trae lo que `getOverview` pide.
    const d = {
      ...(await deps()),
      ids: createSequentialIds('uuid'),
      clock: () => '2026-08-31T10:00:00.000-05:00',
    };
    d.rates = createInMemoryRateRepository(tasas);
    await d.accounts.save(
      createAccount({
        id: wallet,
        owner,
        kind: 'activo',
        nombre: 'USDC en Solana',
        currency: 'USDC',
      }),
    );
    await d.transactions.save(
      createTransaction({
        id: transactionId('saldo-solana'),
        owner,
        fecha: '2026-08-31T10:00:00.000-05:00',
        descripcion: 'Saldo leído de la cadena',
        origen: { fuente: 'manual', referencia: null },
        postings: [
          { accountId: wallet, amount: money(85_761n, 'USDC') },
          { accountId: systemAccountId('ajustes'), amount: money(-85_761n, 'USDC') },
        ],
      }),
    );
    return d;
  }

  /**
   * El invariante, con el polvo dentro. Lo listado más lo declarado como polvo
   * tiene que dar el total exacto: si el polvo se descontara, el patrimonio
   * dejaría de ser comprobable sumando a mano, que es como David lo comprueba.
   */
  it('el patrimonio es la suma exacta de lo listado más el polvo', async () => {
    const overview = await getOverview(await conTasas([TRM, PRECIO_USDC]), owner);

    const suma = overview.cuentas.reduce((s, c) => s + (c.enPesos?.amount ?? 0n), 0n);
    expect(overview.patrimonio.amount).toBe(suma + overview.polvo.total.amount);
  });

  /**
   * 0,085761 USDC son unos 274 pesos: menos de un dólar, así que va al polvo.
   * **Sigue sumando en el patrimonio**: lo que cambia es dónde se enseña.
   */
  it('un saldo cripto de menos de un dólar suma, pero no ensucia la lista', async () => {
    const overview = await getOverview(await conTasas([TRM, PRECIO_USDC]), owner);

    expect(overview.cuentas.find((c) => c.account.id === wallet)).toBeUndefined();
    const enPolvo = overview.polvo.cuentas.find((c) => c.account.id === wallet);
    expect(enPolvo?.enPesos?.amount).toBeGreaterThan(270n);
    expect(overview.patrimonio.amount).toBeGreaterThan(270n);
    expect(overview.sinValorar).toHaveLength(0);
  });

  /**
   * Lo que no se pudo valorar **no** se esconde como polvo: sin tasa no hay
   * con qué compararlo, y esconderlo por si acaso es perder plata de vista.
   */
  it('lo que no se pudo valorar no acaba en el polvo', async () => {
    const overview = await getOverview(await conTasas([]), owner);

    expect(overview.polvo.cuentas).toHaveLength(0);
    expect(overview.sinValorar).toHaveLength(1);
  });

  it('dice con qué tasas valoró y de cuándo son', async () => {
    const overview = await getOverview(await conTasas([TRM, PRECIO_USDC]), owner);

    expect(overview.tasasUsadas).toHaveLength(1);
    expect(overview.tasasUsadas[0]?.momento).toBe('2026-08-29T00:00:00.000-05:00');
  });

  /**
   * Sin tasas no se suma como cero: se declara. Un total que calla lo que no
   * supo valorar miente por omisión.
   */
  it('sin tasas, el saldo queda sin valorar y no entra al total', async () => {
    const overview = await getOverview(await conTasas([]), owner);

    expect(overview.sinValorar).toHaveLength(1);
    expect(overview.sinValorar[0]?.saldo.amount).toBe(85_761n);
    expect(overview.cuentas.find((c) => c.account.id === wallet)?.enPesos).toBeNull();
  });

  /**
   * Cambiar de moneda no es ganar ni perder: si el patrimonio se moviera al
   * convertir, comprar USDC parecería una ganancia.
   */
  it('una conversión entre monedas no mueve el patrimonio', async () => {
    const d = await conTasas([TRM, PRECIO_USDC]);
    const antes = await getOverview(d, owner);

    // A la tasa de mercado: 400.000 pesos son unos 124,87 USDC. Con una tasa
    // inventada la conversión **sí** movería el patrimonio, y con razón: sería
    // un mal negocio, no un fallo del cálculo.
    await convertCurrency(d, {
      owner,
      desde: banco,
      hacia: wallet,
      entrega: money(400_000, 'COP'),
      recibe: money(124_870_000n, 'USDC'),
    });

    const despues = await getOverview(d, owner);
    // Solo queda el redondeo de la tasa, de unos pocos pesos.
    const diferencia = despues.patrimonio.amount - antes.patrimonio.amount;
    expect(diferencia < 100n && diferencia > -100n).toBe(true);
  });
});
