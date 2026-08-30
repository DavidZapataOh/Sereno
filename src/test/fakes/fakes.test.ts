import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

import { createInMemoryAccountRepository } from './in-memory-account-repository';
import { createInMemoryTransactionRepository } from './in-memory-transaction-repository';
import { createSequentialIds } from './sequential-ids';

const owner = ownerId('david');

describe('createSequentialIds', () => {
  it('genera ids predecibles y distintos', () => {
    const ids = createSequentialIds('tx');
    expect(ids.next()).toBe('tx-1');
    expect(ids.next()).toBe('tx-2');
  });
});

describe('createInMemoryAccountRepository', () => {
  it('guarda, recupera y deriva el saldo de los apuntes guardados', async () => {
    const cuentas = createInMemoryAccountRepository();
    await cuentas.save(
      createAccount({ id: accountId('a'), owner, kind: 'activo', nombre: 'A', currency: 'COP' }),
    );

    expect(await cuentas.findById(accountId('a'))).not.toBeNull();
    expect((await cuentas.balanceOf(accountId('a'))).amount).toBe(0n);
    expect(await cuentas.listByOwner(owner)).toHaveLength(1);
  });

  it('balanceOf lanza para una cuenta inexistente, como el real', async () => {
    const cuentas = createInMemoryAccountRepository();
    await expect(cuentas.balanceOf(accountId('nada'))).rejects.toThrow(/nada/);
  });
});

describe('createInMemoryTransactionRepository', () => {
  const tx = (id: string, fecha: string) =>
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'X',
      origen: { fuente: 'prueba', referencia: id },
      postings: [
        { accountId: accountId('a'), amount: money(-100, 'COP') },
        { accountId: accountId('b'), amount: money(100, 'COP') },
      ],
    });

  it('guardar dos veces el mismo id reemplaza, no duplica', async () => {
    const repo = createInMemoryTransactionRepository();
    await repo.save(tx('t1', '2026-08-20T00:00:00.000-05:00'));
    await repo.save(tx('t1', '2026-08-21T00:00:00.000-05:00'));
    expect(repo.all()).toHaveLength(1);
  });

  it('mantiene los apuntes del doble de cuentas, con la fecha de su transacción', async () => {
    const cuentas = createInMemoryAccountRepository();
    await cuentas.save(
      createAccount({ id: accountId('a'), owner, kind: 'activo', nombre: 'A', currency: 'COP' }),
    );
    const repo = createInMemoryTransactionRepository(cuentas.postings);
    await repo.save(tx('t1', '2026-08-20T00:00:00.000-05:00'));
    await repo.save(tx('t2', '2026-08-25T00:00:00.000-05:00'));

    expect((await cuentas.balanceOf(accountId('a'))).amount).toBe(-200n);
    expect(
      (await cuentas.balanceOf(accountId('a'), { hasta: '2026-08-21T00:00:00.000-05:00' })).amount,
    ).toBe(-100n);
    await repo.delete(transactionId('t1'));
    expect((await cuentas.balanceOf(accountId('a'))).amount).toBe(-100n);
  });

  it('lista por fecha descendente y filtra por rango y cuenta', async () => {
    const repo = createInMemoryTransactionRepository();
    await repo.save(tx('vieja', '2026-06-01T00:00:00.000-05:00'));
    await repo.save(tx('nueva', '2026-08-20T00:00:00.000-05:00'));

    const todas = await repo.list(owner);
    expect(todas.items.map((t) => t.id)).toEqual(['nueva', 'vieja']);

    const desde = await repo.list(owner, { desde: '2026-07-01T00:00:00.000-05:00' });
    expect(desde.items.map((t) => t.id)).toEqual(['nueva']);

    const porCuenta = await repo.list(owner, { accountId: accountId('zzz') });
    expect(porCuenta.items).toEqual([]);
  });

  it('pagina por cursor', async () => {
    const repo = createInMemoryTransactionRepository();
    await repo.save(tx('a', '2026-08-01T00:00:00.000-05:00'));
    await repo.save(tx('b', '2026-08-02T00:00:00.000-05:00'));
    await repo.save(tx('c', '2026-08-03T00:00:00.000-05:00'));

    const primera = await repo.list(owner, undefined, { limit: 2 });
    expect(primera.items.map((t) => t.id)).toEqual(['c', 'b']);
    const segunda = await repo.list(owner, undefined, {
      limit: 2,
      cursor: primera.nextCursor ?? undefined,
    });
    expect(segunda.items.map((t) => t.id)).toEqual(['a']);
    expect(segunda.nextCursor).toBeNull();
  });

  it('existsByOrigin y delete se comportan como el real', async () => {
    const repo = createInMemoryTransactionRepository();
    await repo.save(tx('t1', '2026-08-20T00:00:00.000-05:00'));
    expect(await repo.existsByOrigin(owner, 'prueba', 't1')).toBe(true);
    await repo.delete(transactionId('t1'));
    expect(await repo.findById(transactionId('t1'))).toBeNull();
    await expect(repo.delete(transactionId('t1'))).rejects.toThrow(/t1/);
  });
});
