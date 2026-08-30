import type { Rule } from '@/domain/categorization/rule';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleRuleRepository } from './drizzle-rule-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const mercado = accountId('categoria:mercado');

const regla = (id: string, extra: Partial<Rule> = {}): Rule => ({
  id,
  owner,
  campo: 'comercio',
  operador: 'es',
  valor: 'exito',
  categoria: mercado,
  creadaEn: '2026-08-30T10:00:00.000-05:00',
  activa: true,
  ...extra,
});

describe('RuleRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleRuleRepository>;

  beforeEach(async () => {
    cliente = createTestDb();
    repo = createDrizzleRuleRepository(cliente.db);
    await createDrizzleAccountRepository(cliente.db).save(
      createAccount({ id: mercado, owner, kind: 'gasto', nombre: 'Mercado', currency: 'COP' }),
    );
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda, lista por propietario, actualiza al guardar de nuevo y borra', async () => {
    await repo.save(regla('r1'));
    await repo.save(regla('r2', { owner: ownerId('otro') }));
    expect(await repo.findById('r1')).toEqual(regla('r1'));
    expect(await repo.listByOwner(owner)).toHaveLength(1);

    await repo.save(regla('r1', { activa: false, valor: 'carulla' }));
    expect(await repo.findById('r1')).toMatchObject({ activa: false, valor: 'carulla' });

    await repo.delete('r1');
    expect(await repo.findById('r1')).toBeNull();
  });

  it('rechaza una categoría inexistente', async () => {
    await expect(
      repo.save(regla('r3', { categoria: accountId('categoria:nada') })),
    ).rejects.toThrow();
  });
});
