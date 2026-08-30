import { createDrizzleSyncStateRepository } from './drizzle-sync-state-repository';
import { createTestDb } from './test-client';

describe('SyncStateRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleSyncStateRepository>;

  beforeEach(() => {
    cliente = createTestDb();
    repo = createDrizzleSyncStateRepository(cliente.db);
  });
  afterEach(() => {
    cliente.close();
  });

  it('sin cursor guardado empieza en cero, no en nulo', async () => {
    expect(await repo.leerCursor()).toBe(0);
    expect(await repo.ultimaTraida()).toBeNull();
  });

  it('guarda el cursor y lo actualiza sin duplicar filas', async () => {
    await repo.escribirCursor(7);
    await repo.escribirCursor(42);
    expect(await repo.leerCursor()).toBe(42);
  });

  it('la última traída y el cursor son claves distintas', async () => {
    await repo.escribirCursor(7);
    await repo.marcarTraida('2026-08-30T18:00:00.000-05:00');
    expect(await repo.leerCursor()).toBe(7);
    expect(await repo.ultimaTraida()).toBe('2026-08-30T18:00:00.000-05:00');
  });
});
