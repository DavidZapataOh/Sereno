import { sql } from 'drizzle-orm';

import type { Observation } from '@/domain/ingest/observation';
import type { TransferRecord } from '@/domain/ingest/transfer-record';
import { pairKey } from '@/domain/ingest/transfers';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { mustExist } from '@/test/must-exist';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { createDrizzleTransferRepository } from './drizzle-transfer-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const nequi = accountId('nequi:ahorros');

const salida: Transaction = createTransaction({
  id: transactionId('s'),
  owner,
  fecha: '2026-08-10T00:00:00.000-05:00',
  descripcion: 'TRANSFERENCIA A NEQUI',
  origen: { fuente: 'bancolombia', referencia: 's' },
  postings: [
    { accountId: banco, amount: money(-200000, 'COP') },
    { accountId: systemAccountId('gastos-sin-clasificar'), amount: money(200000, 'COP') },
  ],
});
const entrada: Transaction = createTransaction({
  id: transactionId('e'),
  owner,
  fecha: '2026-08-11T00:00:00.000-05:00',
  descripcion: 'Te llegó plata',
  origen: { fuente: 'nequi', referencia: 'e' },
  postings: [
    { accountId: nequi, amount: money(200000, 'COP') },
    { accountId: systemAccountId('ingresos-sin-clasificar'), amount: money(-200000, 'COP') },
  ],
});
const fundida: Transaction = createTransaction({
  ...salida,
  descripcion: 'Transferencia entre cuentas',
  postings: [
    { accountId: banco, amount: money(-200000, 'COP') },
    { accountId: nequi, amount: money(200000, 'COP') },
  ],
});
const observacionEntrada: Observation = {
  id: 'e@nequi',
  transactionId: transactionId('e'),
  owner,
  fuente: 'nequi',
  referencia: 'e',
  huella: '2026-08-11|200000|te llego plata',
  capturadoEn: '2026-08-11T10:00:00.000-05:00',
  runId: null,
  crudo: {
    fecha: '2026/08/11',
    descripcion: 'Te llegó plata',
    monto: 200000,
    moneda: 'COP',
    tipo: 'credito',
    fuente: 'nequi',
    referencia: 'e',
  },
};

const registro = (id: string, extra: Partial<TransferRecord> = {}): TransferRecord => ({
  id,
  owner,
  transactionId: transactionId('s'),
  salida,
  entrada,
  observacionesEntrada: [observacionEntrada],
  estado: 'detectada',
  detectadaEn: '2026-08-12T10:00:00.000-05:00',
  resueltaEn: null,
  ...extra,
});

describe('TransferRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleTransferRepository>;

  beforeEach(async () => {
    cliente = createTestDb();
    repo = createDrizzleTransferRepository(cliente.db);
    const cuentas = createDrizzleAccountRepository(cliente.db);
    for (const [id, kind, nombre] of [
      [banco, 'activo', 'Bancolombia'],
      [nequi, 'activo', 'Nequi'],
      [systemAccountId('gastos-sin-clasificar'), 'gasto', 'G'],
      [systemAccountId('ingresos-sin-clasificar'), 'ingreso', 'I'],
    ] as const) {
      await cuentas.save(createAccount({ id, owner, kind, nombre, currency: 'COP' }));
    }
    // La clave foránea exige que la transacción fundida exista.
    await createDrizzleTransactionRepository(cliente.db).save(fundida);
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda y recupera por id, con las instantáneas intactas', async () => {
    await repo.save(registro('tr-1'));

    const leido = mustExist(await repo.findById('tr-1'));
    expect(leido.salida).toEqual(salida);
    expect(leido.entrada).toEqual(entrada);
    expect(leido.observacionesEntrada).toEqual([observacionEntrada]);
    expect(leido.estado).toBe('detectada');
  });

  it('encuentra por transacción', async () => {
    await repo.save(registro('tr-1'));
    expect(mustExist(await repo.findByTransaction(transactionId('s'))).id).toBe('tr-1');
    expect(await repo.findByTransaction(transactionId('nada'))).toBeNull();
  });

  it('lista por propietario y, opcionalmente, por estado', async () => {
    await repo.save(registro('tr-1'));
    await repo.save(
      registro('tr-2', { estado: 'confirmada', resueltaEn: '2026-08-13T10:00:00.000-05:00' }),
    );

    expect((await repo.listByOwner(owner)).map((r) => r.id).sort()).toEqual(['tr-1', 'tr-2']);
    expect((await repo.listByOwner(owner, 'confirmada')).map((r) => r.id)).toEqual(['tr-2']);
    expect(await repo.listByOwner(ownerId('otro'))).toEqual([]);
  });

  it('undoneKeys devuelve solo las claves de las deshechas', async () => {
    await repo.save(registro('tr-1'));
    await repo.save(
      registro('tr-2', { estado: 'deshecha', resueltaEn: '2026-08-13T10:00:00.000-05:00' }),
    );

    expect(await repo.undoneKeys(owner)).toEqual(
      new Set([pairKey(transactionId('s'), transactionId('e'))]),
    );
  });

  it('guardar de nuevo actualiza el estado', async () => {
    await repo.save(registro('tr-1'));
    await repo.save(
      registro('tr-1', { estado: 'confirmada', resueltaEn: '2026-08-13T10:00:00.000-05:00' }),
    );

    expect(mustExist(await repo.findById('tr-1')).estado).toBe('confirmada');
    expect(await repo.listByOwner(owner)).toHaveLength(1);
  });

  it('rechaza un registro contra una transacción inexistente', async () => {
    await expect(
      repo.save(registro('tr-1', { transactionId: transactionId('fantasma') })),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });

  it('una instantánea corrupta falla al leer, no devuelve basura', async () => {
    await repo.save(registro('tr-1'));
    cliente.db.run(sql`UPDATE transfers SET salida = '{"id":"s"}' WHERE id = 'tr-1'`);

    await expect(repo.findById('tr-1')).rejects.toThrow();
  });
});
