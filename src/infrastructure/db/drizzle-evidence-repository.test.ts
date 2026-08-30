import { accountId, ownerId } from '@/domain/ledger/ids';

import { createDrizzleEvidenceRepository } from './drizzle-evidence-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const mercado = accountId('categoria:mercado');
const hogar = accountId('categoria:hogar');

describe('EvidenceRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleEvidenceRepository>;

  beforeEach(() => {
    cliente = createTestDb();
    repo = createDrizzleEvidenceRepository(cliente.db);
  });

  afterEach(() => {
    cliente.close();
  });

  it('sumar dos veces da 2; restar tres veces deja 0, no -1', async () => {
    await repo.add(owner, ['comercio:exito', 'palabra:exito'], mercado, 1);
    await repo.add(owner, ['comercio:exito'], mercado, 1);
    expect(await repo.listByFeatures(owner, ['comercio:exito', 'palabra:exito'])).toEqual([
      { feature: 'comercio:exito', categoria: mercado, cuenta: 2 },
      { feature: 'palabra:exito', categoria: mercado, cuenta: 1 },
    ]);

    await repo.add(owner, ['comercio:exito'], mercado, -1);
    await repo.add(owner, ['comercio:exito'], mercado, -1);
    await repo.add(owner, ['comercio:exito'], mercado, -1);
    // A cero deja de listarse: ya no es evidencia.
    expect(await repo.listByFeatures(owner, ['comercio:exito'])).toEqual([]);
  });

  it('con lista vacía no consulta; no mezcla propietarios; suma por categoría', async () => {
    await repo.add(owner, ['comercio:exito', 'palabra:exito'], mercado, 1);
    await repo.add(owner, ['comercio:homecenter'], hogar, 1);
    await repo.add(ownerId('otro'), ['comercio:exito'], mercado, 1);

    expect(await repo.listByFeatures(owner, [])).toEqual([]);
    expect(await repo.listByFeatures(owner, ['comercio:exito'])).toHaveLength(1);
    expect(await repo.countByCategory(owner)).toEqual(
      new Map([
        [mercado, 2],
        [hogar, 1],
      ]),
    );
    expect(await repo.vocabularySize(owner)).toBe(3);
    expect(await repo.vocabularySize(ownerId('nadie'))).toBe(0);
  });
});
