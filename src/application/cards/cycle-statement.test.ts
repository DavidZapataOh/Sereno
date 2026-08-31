import { createCreditCard } from '@/domain/cards/card';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryCardRepository } from '@/test/fakes/in-memory-card-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';

import { cycleStatement } from './cycle-statement';

const owner = ownerId('david');
const rappi = accountId('rappicard:tarjeta');
const ahorros = accountId('bancolombia:ahorros');
const gastos = accountId('sistema:gastos-sin-clasificar');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const cards = createInMemoryCardRepository();
  await accounts.save(
    createAccount({ id: rappi, owner, kind: 'pasivo', nombre: 'RappiCard', currency: 'COP' }),
  );
  await accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  await accounts.save(
    createAccount({ id: gastos, owner, kind: 'gasto', nombre: 'Sin clasificar', currency: 'COP' }),
  );
  await cards.save(
    createCreditCard({
      accountId: rappi,
      owner,
      cupo: money(3_000_000, 'COP'),
      diaDeCorte: 15,
      diaDePago: 5,
    }),
  );
  return { accounts, transactions, cards };
}

let n = 0;
/** Una compra con la tarjeta: sube la deuda (negativo sobre el pasivo). */
async function comprar(d: Awaited<ReturnType<typeof deps>>, fecha: string, monto: number) {
  n += 1;
  await d.transactions.save(
    createTransaction({
      id: transactionId(`compra-${String(n)}`),
      owner,
      fecha,
      descripcion: 'COMERCIO',
      origen: { fuente: 'rappicard', referencia: `c${String(n)}` },
      postings: [
        { accountId: rappi, amount: money(-monto, 'COP') },
        { accountId: gastos, amount: money(monto, 'COP') },
      ],
    }),
  );
}

/** Un pago a la tarjeta: baja la deuda. */
async function pagar(d: Awaited<ReturnType<typeof deps>>, fecha: string, monto: number) {
  n += 1;
  await d.transactions.save(
    createTransaction({
      id: transactionId(`pago-${String(n)}`),
      owner,
      fecha,
      descripcion: 'Pago de tarjeta',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: rappi, amount: money(monto, 'COP') },
        { accountId: ahorros, amount: money(-monto, 'COP') },
      ],
    }),
  );
}

const enAgosto = { owner, accountId: rappi, fecha: '2026-08-20T10:00:00.000-05:00' };

describe('cycleStatement', () => {
  it('suma las compras del ciclo', async () => {
    const d = await deps();
    await comprar(d, '2026-08-16T10:00:00.000-05:00', 45_000);
    await comprar(d, '2026-09-01T10:00:00.000-05:00', 30_000);

    const extracto = await cycleStatement(d, enAgosto);

    expect(extracto?.ciclo.corte).toBe('2026-08-15');
    expect(extracto?.compras.amount).toBe(75_000n);
    expect(extracto?.movimientos).toHaveLength(2);
  });

  it('una compra del ciclo anterior no entra', async () => {
    const d = await deps();
    await comprar(d, '2026-08-14T10:00:00.000-05:00', 45_000);

    expect((await cycleStatement(d, enAgosto))?.compras.amount).toBe(0n);
  });

  it('una compra del ciclo siguiente tampoco', async () => {
    const d = await deps();
    await comprar(d, '2026-09-15T10:00:00.000-05:00', 45_000);

    expect((await cycleStatement(d, enAgosto))?.compras.amount).toBe(0n);
  });

  it('no cuenta los pagos como si fueran compras', async () => {
    const d = await deps();
    await comprar(d, '2026-08-16T10:00:00.000-05:00', 45_000);
    // Un abono dentro del propio ciclo: baja la deuda, no es una compra.
    await pagar(d, '2026-08-20T10:00:00.000-05:00', 20_000);

    expect((await cycleStatement(d, enAgosto))?.compras.amount).toBe(45_000n);
  });

  it('cuenta como pago del ciclo lo que se paga en su ventana', async () => {
    const d = await deps();
    await comprar(d, '2026-08-16T10:00:00.000-05:00', 45_000);
    // El ciclo cierra el 15 de septiembre y vence el 5 de octubre.
    await pagar(d, '2026-10-03T10:00:00.000-05:00', 45_000);

    expect((await cycleStatement(d, enAgosto))?.pagos.amount).toBe(45_000n);
  });

  it('un pago posterior al vencimiento no es de este ciclo', async () => {
    const d = await deps();
    await comprar(d, '2026-08-16T10:00:00.000-05:00', 45_000);
    await pagar(d, '2026-10-20T10:00:00.000-05:00', 45_000);

    expect((await cycleStatement(d, enAgosto))?.pagos.amount).toBe(0n);
  });

  it('una cuenta que no es tarjeta no tiene extracto', async () => {
    const d = await deps();

    expect(await cycleStatement(d, { ...enAgosto, accountId: ahorros })).toBeNull();
  });

  it('no devuelve el extracto de otro propietario', async () => {
    const d = await deps();

    expect(await cycleStatement(d, { ...enAgosto, owner: ownerId('otro') })).toBeNull();
  });
});
