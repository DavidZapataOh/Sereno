import { createCreditCard } from '@/domain/cards/card';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryCardRepository } from '@/test/fakes/in-memory-card-repository';
import { createInMemoryDebtRepository } from '@/test/fakes/in-memory-debt-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { configureDebt } from './configure-debt';
import { listDebts, type ListDebtsDeps } from './list-debts';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const tarjeta = accountId('rappicard:tarjeta');
const prestamo = accountId('prestamo:banco');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  for (const [id, nombre, kind] of [
    [banco, 'Bancolombia', 'activo'],
    [tarjeta, 'RappiCard', 'pasivo'],
    [prestamo, 'Crédito', 'pasivo'],
  ] as const) {
    await accounts.save(createAccount({ id, owner, kind, nombre, currency: 'COP' }));
  }
  const d: ListDebtsDeps = {
    accounts,
    debts: createInMemoryDebtRepository(),
    cards: createInMemoryCardRepository(),
  };
  return { ...d, accounts, transactions };
}

const deber = async (d: Awaited<ReturnType<typeof deps>>, cuenta: typeof tarjeta, cuanto: bigint) =>
  d.transactions.save(
    createTransaction({
      id: transactionId(`deuda-${cuenta}`),
      owner,
      fecha: '2026-08-01T10:00:00.000-05:00',
      descripcion: 'Compra',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: cuenta, amount: money(-cuanto, 'COP') },
        { accountId: systemAccountId('ajustes'), amount: money(cuanto, 'COP') },
      ],
    }),
  );

describe('listDebts', () => {
  it('el saldo sale del ledger, no de nada guardado', async () => {
    const d = await deps();
    await deber(d, prestamo, 1_000_000n);

    const encontrada = (await listDebts(d, owner)).find((x) => x.accountId === prestamo);
    expect(encontrada?.saldo.amount).toBe(-1_000_000n);
  });

  /**
   * Una tarjeta es un tipo de deuda, no una cosa aparte. Si no apareciera, la
   * pantalla de deudas mentiría por omisión sobre lo más grande que suele haber.
   */
  it('incluye las tarjetas del sprint 07 como deudas', async () => {
    const d = await deps();
    await d.cards.save(
      createCreditCard({
        accountId: tarjeta,
        owner,
        cupo: money(2_000_000, 'COP'),
        diaDeCorte: 15,
        diaDePago: 5,
      }),
    );

    expect((await listDebts(d, owner)).map((x) => x.accountId)).toContain(tarjeta);
  });

  /**
   * Un pasivo que llegó por la ingesta y que nadie ha configurado sigue siendo
   * plata que se debe: esconderlo porque le faltan datos es mentir por omisión.
   */
  it('lista los pasivos sin términos declarados, con terminos en null', async () => {
    const d = await deps();

    const sinDeclarar = (await listDebts(d, owner)).find((x) => x.accountId === prestamo);
    expect(sinDeclarar).toBeDefined();
    expect(sinDeclarar?.terminos).toBeNull();
  });

  it('usa el nombre declarado cuando lo hay', async () => {
    const d = await deps();
    await configureDebt(d, {
      owner,
      accountId: prestamo,
      tipo: 'prestamo',
      nombre: 'Crédito de estudio',
      tasa: { valor: 0.24, tipo: 'EA' },
      cuotasTotales: 36,
      diaDePago: 15,
    });

    expect((await listDebts(d, owner)).find((x) => x.accountId === prestamo)?.nombre).toBe(
      'Crédito de estudio',
    );
  });

  it('no lista cuentas que no son pasivos', async () => {
    const d = await deps();

    expect((await listDebts(d, owner)).map((x) => x.accountId)).not.toContain(banco);
  });

  it('una deuda saldada sale en cero, no desaparece', async () => {
    const d = await deps();

    const saldada = (await listDebts(d, owner)).find((x) => x.accountId === tarjeta);
    expect(saldada?.saldo.amount).toBe(0n);
  });

  it('no mezcla las deudas de otro propietario', async () => {
    const d = await deps();
    await d.accounts.save(
      createAccount({
        id: accountId('ajena'),
        owner: ownerId('otro'),
        kind: 'pasivo',
        nombre: 'Ajena',
        currency: 'COP',
      }),
    );

    expect((await listDebts(d, owner)).map((x) => x.accountId)).not.toContain('ajena');
  });
});

describe('configureDebt', () => {
  it('guarda los términos de un pasivo existente', async () => {
    const d = await deps();

    const deuda = await configureDebt(d, {
      owner,
      accountId: prestamo,
      tipo: 'prestamo',
      nombre: 'Crédito',
      tasa: { valor: 0.24, tipo: 'EA' },
      cuotasTotales: 36,
      diaDePago: 15,
    });

    expect(await d.debts.buscar(prestamo)).toEqual(deuda);
  });

  it('no deja declarar como deuda una cuenta que no es pasivo', async () => {
    const d = await deps();

    await expect(
      configureDebt(d, {
        owner,
        accountId: banco,
        tipo: 'prestamo',
        nombre: 'x',
        tasa: null,
        cuotasTotales: null,
        diaDePago: null,
      }),
    ).rejects.toThrow(/no es una deuda/);
  });

  it('rechaza una cuenta de otro propietario', async () => {
    const d = await deps();

    await expect(
      configureDebt(d, {
        owner: ownerId('otro'),
        accountId: prestamo,
        tipo: 'prestamo',
        nombre: 'x',
        tasa: null,
        cuotasTotales: null,
        diaDePago: null,
      }),
    ).rejects.toThrow(/No existe/);
  });

  it('volver a configurar reemplaza, no duplica', async () => {
    const d = await deps();
    const entrada = {
      owner,
      accountId: prestamo,
      tipo: 'prestamo' as const,
      nombre: 'Uno',
      tasa: null,
      cuotasTotales: null,
      diaDePago: null,
    };
    await configureDebt(d, entrada);
    await configureDebt(d, { ...entrada, nombre: 'Dos' });

    expect(await d.debts.listar(owner)).toHaveLength(1);
  });
});
