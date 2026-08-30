import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleCategoryRepository } from './drizzle-category-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const mercado = accountId('categoria:mercado');

describe('CategoryRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleCategoryRepository>;

  beforeEach(async () => {
    cliente = createTestDb();
    repo = createDrizzleCategoryRepository(cliente.db);
    await createDrizzleAccountRepository(cliente.db).save(
      createAccount({ id: mercado, owner, kind: 'gasto', nombre: 'Mercado', currency: 'COP' }),
    );
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda el detalle de una cuenta, lo encuentra y lo actualiza al guardar de nuevo', async () => {
    await repo.saveDetails({ accountId: mercado, owner, grupo: 'comida', icono: 'cart', orden: 1 });
    expect(await repo.findDetails(mercado)).toEqual({
      accountId: mercado,
      owner,
      grupo: 'comida',
      icono: 'cart',
      orden: 1,
    });

    await repo.saveDetails({
      accountId: mercado,
      owner,
      grupo: 'comida',
      icono: 'basket',
      orden: 3,
    });
    expect(await repo.findDetails(mercado)).toMatchObject({ icono: 'basket', orden: 3 });
    expect(await repo.listDetails(owner)).toHaveLength(1);
  });

  it('lista por propietario y devuelve null para lo que no existe', async () => {
    expect(await repo.listDetails(owner)).toEqual([]);
    expect(await repo.findDetails(accountId('categoria:nada'))).toBeNull();
  });

  it('rechaza el detalle de una cuenta inexistente', async () => {
    await expect(
      repo.saveDetails({
        accountId: accountId('categoria:nada'),
        owner,
        grupo: 'otros',
        icono: 'x',
        orden: 1,
      }),
    ).rejects.toThrow();
  });
});
