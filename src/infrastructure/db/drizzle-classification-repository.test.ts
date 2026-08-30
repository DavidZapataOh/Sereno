import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleClassificationRepository } from './drizzle-classification-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');
const gastos = accountId('sistema:gastos-sin-clasificar');
const c1 = transactionId('bancolombia:C1');

describe('ClassificationRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleClassificationRepository>;
  let transactions: ReturnType<typeof createDrizzleTransactionRepository>;

  beforeEach(async () => {
    cliente = createTestDb();
    repo = createDrizzleClassificationRepository(cliente.db);
    transactions = createDrizzleTransactionRepository(cliente.db);
    const accounts = createDrizzleAccountRepository(cliente.db);
    await accounts.save(
      createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
    );
    await accounts.save(
      createAccount({
        id: gastos,
        owner,
        kind: 'gasto',
        nombre: 'Sin clasificar',
        currency: 'COP',
      }),
    );
    await transactions.save(
      createTransaction({
        id: c1,
        owner,
        fecha: '2026-08-30T00:00:00.000-05:00',
        descripcion: 'COMPRA EXITO',
        origen: { fuente: 'bancolombia', referencia: 'C1' },
        postings: [
          { accountId: ahorros, amount: money(-45000, 'COP') },
          { accountId: gastos, amount: money(45000, 'COP') },
        ],
      }),
    );
  });

  afterEach(() => {
    cliente.close();
  });

  const clasificacion = (extra: Partial<Parameters<typeof repo.save>[0]> = {}) => ({
    transactionId: c1,
    owner,
    categoria: accountId('categoria:mercado'),
    origen: 'aprendida' as const,
    reglaId: null,
    confianza: 72,
    clasificadoEn: '2026-08-30T10:00:00.000-05:00',
    ...extra,
  });

  it('guarda, recupera y reemplaza al guardar de nuevo', async () => {
    await repo.save(clasificacion());
    expect(await repo.findByTransaction(c1)).toEqual(clasificacion());
    await repo.save(clasificacion({ origen: 'manual', confianza: 100 }));
    expect(await repo.findByTransaction(c1)).toMatchObject({ origen: 'manual', confianza: 100 });
    expect(await repo.listByOwner(owner)).toHaveLength(1);
  });

  it('filtra por origen', async () => {
    await repo.save(clasificacion({ origen: 'manual', confianza: 100 }));
    expect(await repo.listByOwner(owner, { origen: 'manual' })).toHaveLength(1);
    expect(await repo.listByOwner(owner, { origen: 'regla' })).toEqual([]);
  });

  it('borrar la transacción borra la clasificación en cascada; borrar la clasificación no toca la transacción', async () => {
    await repo.save(clasificacion());
    await repo.delete(c1);
    expect(await repo.findByTransaction(c1)).toBeNull();
    expect(await transactions.findById(c1)).not.toBeNull();

    await repo.save(clasificacion());
    await transactions.delete(c1);
    expect(await repo.findByTransaction(c1)).toBeNull();
  });

  it('rechaza una transacción inexistente', async () => {
    await expect(
      repo.save(clasificacion({ transactionId: transactionId('bancolombia:nada') })),
    ).rejects.toThrow();
  });
});
