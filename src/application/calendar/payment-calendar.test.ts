import { createCreditCard } from '@/domain/cards/card';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryCardRepository } from '@/test/fakes/in-memory-card-repository';
import { createInMemoryCategoryRepository } from '@/test/fakes/in-memory-category-repository';
import { createInMemoryClassificationRepository } from '@/test/fakes/in-memory-classification-repository';
import { createInMemoryDebtRepository } from '@/test/fakes/in-memory-debt-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { paymentCalendar, type CalendarDeps } from './payment-calendar';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const tarjeta = accountId('rappicard:tarjeta');
const prestamo = accountId('prestamo:banco');

const HOY = '2026-09-10T10:00:00.000-05:00';
const RANGO = { desde: '2026-09-01', hasta: '2026-09-30' };

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

  const d: CalendarDeps = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    categories: createInMemoryCategoryRepository(),
    classifications: createInMemoryClassificationRepository(),
    cards: createInMemoryCardRepository(),
    debts: createInMemoryDebtRepository(),
    clock: () => HOY,
  };
  return { ...d, accounts, transactions, cards: d.cards, debts: d.debts };
}

const conTarjeta = (d: Awaited<ReturnType<typeof deps>>) =>
  d.cards.save(
    createCreditCard({
      accountId: tarjeta,
      owner,
      cupo: money(2_000_000, 'COP'),
      diaDeCorte: 15,
      diaDePago: 5,
    }),
  );

const conPrestamo = (d: Awaited<ReturnType<typeof deps>>) =>
  d.debts.guardar({
    accountId: prestamo,
    owner,
    tipo: 'prestamo',
    nombre: 'Crédito',
    tasa: { valor: 0.24, tipo: 'EA' },
    cuotasTotales: 36,
    diaDePago: 20,
  });

const asentar = (
  d: Awaited<ReturnType<typeof deps>>,
  id: string,
  cuenta: typeof tarjeta,
  monto: bigint,
  fecha: string,
) =>
  d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'movimiento',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: cuenta, amount: money(monto, 'COP') },
        { accountId: systemAccountId('ajustes'), amount: money(-monto, 'COP') },
      ],
    }),
  );

describe('paymentCalendar', () => {
  it('trae el pago de cada tarjeta configurada, en su día', async () => {
    const d = await deps();
    await conTarjeta(d);

    const obligaciones = await paymentCalendar(d, { owner, ...RANGO });

    expect(obligaciones.filter((o) => o.origen === 'tarjeta').map((o) => o.vence)).toEqual([
      '2026-09-05',
    ]);
  });

  it('trae una cuota por préstamo mientras quede saldo', async () => {
    const d = await deps();
    await conPrestamo(d);
    await asentar(d, 'deuda', prestamo, -1_000_000n, '2026-08-01T10:00:00.000-05:00');

    const cuotas = (await paymentCalendar(d, { owner, ...RANGO })).filter(
      (o) => o.origen === 'cuota',
    );

    expect(cuotas.map((o) => o.vence)).toEqual(['2026-09-20']);
  });

  it('sale ordenado por fecha, mezclando orígenes', async () => {
    const d = await deps();
    await conTarjeta(d);
    await conPrestamo(d);
    await asentar(d, 'deuda', prestamo, -1_000_000n, '2026-08-01T10:00:00.000-05:00');

    const fechas = (await paymentCalendar(d, { owner, ...RANGO })).map((o) => o.vence);

    expect(fechas).toEqual([...fechas].sort());
  });

  /**
   * Lo que separa esto de una lista de deseos. Si hay un apunte que baja la
   * deuda dentro de la ventana del ciclo, está pagada: lo dice el ledger, no
   * una casilla que alguien tenga que marcar.
   */
  it('marca pagada la tarjeta que ya se pagó en este ciclo', async () => {
    const d = await deps();
    await conTarjeta(d);
    // La ventana de pago del ciclo que vence el 5 de septiembre.
    await asentar(d, 'pago', tarjeta, 300_000n, '2026-09-02T10:00:00.000-05:00');

    const pago = (await paymentCalendar(d, { owner, ...RANGO })).find(
      (o) => o.origen === 'tarjeta',
    );

    expect(pago?.estado).toBe('pagada');
  });

  it('una compra no cuenta como pago: se mira el signo, no la descripción', async () => {
    const d = await deps();
    await conTarjeta(d);
    await asentar(d, 'compra', tarjeta, -50_000n, '2026-09-02T10:00:00.000-05:00');

    expect(
      (await paymentCalendar(d, { owner, ...RANGO })).find((o) => o.origen === 'tarjeta')?.estado,
    ).not.toBe('pagada');
  });

  /**
   * El caso que hace inútil una app de recordatorios: avisar de algo que no
   * existe. Una tarjeta sin ciclo configurado no tiene fecha que se pueda
   * saber, y una inventada es una alarma falsa.
   */
  it('no inventa obligaciones que el ledger no respalde', async () => {
    const d = await deps();

    expect(await paymentCalendar(d, { owner, ...RANGO })).toEqual([]);
  });

  it('el monto de la tarjeta es null hasta que cierra el ciclo', async () => {
    const d = await deps();
    await conTarjeta(d);

    expect(
      (await paymentCalendar(d, { owner, ...RANGO })).find((o) => o.origen === 'tarjeta')?.monto,
    ).toBeNull();
  });

  it('una deuda saldada deja de generar cuotas', async () => {
    const d = await deps();
    await conPrestamo(d);

    expect(
      (await paymentCalendar(d, { owner, ...RANGO })).filter((o) => o.origen === 'cuota'),
    ).toEqual([]);
  });

  it('respeta el rango pedido, incluidos los extremos', async () => {
    const d = await deps();
    await conTarjeta(d);

    const fuera = await paymentCalendar(d, { owner, desde: '2026-09-06', hasta: '2026-09-30' });
    const dentro = await paymentCalendar(d, { owner, desde: '2026-09-05', hasta: '2026-09-05' });

    expect(fuera.filter((o) => o.origen === 'tarjeta')).toEqual([]);
    expect(dentro.filter((o) => o.origen === 'tarjeta')).toHaveLength(1);
  });

  it('lo que venció sin pago sale como vencida', async () => {
    const d = await deps();
    await conTarjeta(d);

    // Vence el 5, hoy es 10: venció sin pago.
    expect(
      (await paymentCalendar(d, { owner, ...RANGO })).find((o) => o.origen === 'tarjeta')?.estado,
    ).toBe('vencida');
  });

  it('no devuelve obligaciones de otro propietario', async () => {
    const d = await deps();
    await conTarjeta(d);

    expect(await paymentCalendar(d, { owner: ownerId('otro'), ...RANGO })).toEqual([]);
  });

  it('el id es estable entre corridas', async () => {
    const d = await deps();
    await conTarjeta(d);

    const a = await paymentCalendar(d, { owner, ...RANGO });
    const b = await paymentCalendar(d, { owner, ...RANGO });
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id));
  });
});
