import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemorySinkingRepository } from '@/test/fakes/in-memory-sinking-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { listFunds, type FundDeps } from './manage-funds';
import { setAside, type SetAsideDeps } from './set-aside';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const fondo = accountId('fondo:seguro');
const HOY = '2026-09-15T10:00:00.000-05:00';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  await transactions.save(
    createTransaction({
      id: transactionId('apertura'),
      owner,
      fecha: '2026-09-01T10:00:00.000-05:00',
      descripcion: 'Apertura',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(5_000_000, 'COP') },
        { accountId: systemAccountId('ajustes'), amount: money(-5_000_000, 'COP') },
      ],
    }),
  );

  const fondos = createInMemorySinkingRepository();
  await fondos.guardar({
    accountId: fondo,
    owner,
    nombre: 'Seguro del carro',
    tipo: 'gasto',
    objetivo: money(1_200_000, 'COP'),
    proximaFecha: '2027-09-01',
    cadaMeses: 12,
  });

  const d: SetAsideDeps & FundDeps = {
    accounts,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => HOY,
    fondos,
  };
  return { ...d, accounts, transactions, fondos };
}

/** El patrimonio: activos más pasivos. */
const patrimonio = async (d: Awaited<ReturnType<typeof deps>>) => {
  let total = 0n;
  for (const c of await d.accounts.listByOwner(owner)) {
    if (c.kind === 'activo' || c.kind === 'pasivo') {
      total += (await d.accounts.balanceOf(c.id)).amount;
    }
  }
  return total;
};

describe('setAside', () => {
  /**
   * Lo que este plan existe para que salga bien. Con un fondo de tipo
   * `patrimonio` esto habría bajado el patrimonio neto, porque `isRealAccount`
   * solo cuenta activos y pasivos: apartar habría parecido perder.
   */
  it('mueve del banco al fondo sin tocar el patrimonio', async () => {
    const d = await deps();
    const antes = await patrimonio(d);

    await setAside(d, { owner, fondo, desde: banco, monto: money(100_000, 'COP') });

    expect(await patrimonio(d)).toBe(antes);
  });

  it('el fondo queda con lo apartado y el banco con menos', async () => {
    const d = await deps();
    await setAside(d, { owner, fondo, desde: banco, monto: money(100_000, 'COP') });

    expect((await d.accounts.balanceOf(fondo)).amount).toBe(100_000n);
    expect((await d.accounts.balanceOf(banco)).amount).toBe(4_900_000n);
  });

  it('la cuenta del fondo se crea como activo, no como patrimonio', async () => {
    const d = await deps();
    await setAside(d, { owner, fondo, desde: banco, monto: money(1_000, 'COP') });

    expect((await d.accounts.findById(fondo))?.kind).toBe('activo');
  });

  /**
   * Apartar no puede aparecer en «en qué se me va la plata». Se compara antes y
   * después porque el sistema ya trae sus propias cuentas de gasto.
   */
  it('no crea ninguna cuenta de gasto nueva', async () => {
    const d = await deps();
    const gastosAntes = (await d.accounts.listByOwner(owner)).filter(
      (c) => c.kind === 'gasto',
    ).length;

    await setAside(d, { owner, fondo, desde: banco, monto: money(1_000, 'COP') });

    const gastosDespues = (await d.accounts.listByOwner(owner)).filter(
      (c) => c.kind === 'gasto',
    ).length;
    expect(gastosDespues).toBe(gastosAntes);
  });

  it('la transacción cuadra', async () => {
    const d = await deps();
    await setAside(d, { owner, fondo, desde: banco, monto: money(100_000, 'COP') });

    const tx = d.transactions.all().at(-1);
    expect(tx?.postings.reduce((acc, p) => acc + p.amount.amount, 0n)).toBe(0n);
  });

  it('rechaza apartar a algo que no es un fondo', async () => {
    const d = await deps();

    await expect(
      setAside(d, { owner, fondo: banco, desde: banco, monto: money(1_000, 'COP') }),
    ).rejects.toThrow();
  });

  it('rechaza un monto que no es positivo', async () => {
    const d = await deps();

    await expect(
      setAside(d, { owner, fondo, desde: banco, monto: money(0, 'COP') }),
    ).rejects.toThrow(/positivo/i);
  });

  it('rechaza monedas distintas', async () => {
    const d = await deps();

    await expect(
      setAside(d, { owner, fondo, desde: banco, monto: money(1, 'USDC') }),
    ).rejects.toThrow(/moneda/i);
  });

  it('rechaza un fondo de otro propietario', async () => {
    const d = await deps();

    await expect(
      setAside(d, { owner: ownerId('otro'), fondo, desde: banco, monto: money(1_000, 'COP') }),
    ).rejects.toThrow();
  });
});

describe('listFunds', () => {
  it('lo apartado sale del ledger, no de nada guardado', async () => {
    const d = await deps();
    await setAside(d, { owner, fondo, desde: banco, monto: money(300_000, 'COP') });

    const [estado] = await listFunds(d, owner);
    expect(estado?.apartado.amount).toBe(300_000n);
    expect(estado?.falta.amount).toBe(900_000n);
  });

  it('dice cuánto toca apartar este mes', async () => {
    const d = await deps();

    const [estado] = await listFunds(d, owner);
    expect(estado?.aporteDeEsteMes.amount).toBeGreaterThan(0n);
    expect(estado?.alcanza).toBe(true);
  });

  it('un fondo sin cuenta todavía empieza en cero, no falla', async () => {
    const d = await deps();

    expect((await listFunds(d, owner))[0]?.apartado.amount).toBe(0n);
  });

  /** Un seguro anual pagado vuelve a apuntar al año siguiente, sin renovarlo. */
  it('un fondo cumplido y vencido se reproyecta al siguiente ciclo', async () => {
    const d = await deps();
    await d.fondos.guardar({
      accountId: fondo,
      owner,
      nombre: 'Seguro del carro',
      tipo: 'gasto',
      objetivo: money(1_200_000, 'COP'),
      proximaFecha: '2026-08-01',
      cadaMeses: 12,
    });
    await setAside(d, { owner, fondo, desde: banco, monto: money(1_200_000, 'COP') });

    expect((await listFunds(d, owner))[0]?.fondo.proximaFecha).toBe('2027-08-01');
  });

  it('no devuelve los fondos de otro propietario', async () => {
    const d = await deps();

    expect(await listFunds(d, ownerId('otro'))).toEqual([]);
  });
});
