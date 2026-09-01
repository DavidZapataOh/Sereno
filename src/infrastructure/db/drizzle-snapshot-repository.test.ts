import { ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import type { Snapshot } from '@/domain/overview/snapshot';

import { createDrizzleSnapshotRepository } from './drizzle-snapshot-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const otro = ownerId('otra-persona');

const punto = (dia: string, amount: bigint): Snapshot => ({
  owner,
  dia,
  patrimonio: money(amount, 'COP'),
  tasas: 'TRM oficial (2026-08-29T00:00:00.000-05:00)',
  tomadaEn: `${dia}T10:00:00.000-05:00`,
});

describe('SnapshotRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleSnapshotRepository>;

  beforeEach(() => {
    cliente = createTestDb();
    repo = createDrizzleSnapshotRepository(cliente.db);
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda y devuelve una instantánea', async () => {
    await repo.guardar(punto('2026-08-31', 1_814_013n));

    expect(await repo.serie(owner, '2026-08-01', '2026-08-31')).toEqual([
      punto('2026-08-31', 1_814_013n),
    ]);
  });

  /** Dos arranques el mismo día son un punto, no dos. */
  it('la del mismo día se reemplaza', async () => {
    await repo.guardar(punto('2026-08-31', 100n));
    await repo.guardar(punto('2026-08-31', 200n));

    const serie = await repo.serie(owner, '2026-08-01', '2026-08-31');
    expect(serie).toHaveLength(1);
    expect(serie[0]?.patrimonio.amount).toBe(200n);
  });

  it('devuelve la serie en orden de día', async () => {
    for (const dia of ['2026-08-31', '2026-08-15', '2026-08-20']) {
      await repo.guardar(punto(dia, 1n));
    }

    expect((await repo.serie(owner, '2026-08-01', '2026-08-31')).map((s) => s.dia)).toEqual([
      '2026-08-15',
      '2026-08-20',
      '2026-08-31',
    ]);
  });

  it('el rango incluye los extremos', async () => {
    await repo.guardar(punto('2026-08-01', 1n));
    await repo.guardar(punto('2026-08-31', 2n));

    expect(await repo.serie(owner, '2026-08-01', '2026-08-31')).toHaveLength(2);
  });

  it('deja fuera lo que no está en el rango', async () => {
    await repo.guardar(punto('2026-07-31', 1n));
    await repo.guardar(punto('2026-09-01', 2n));

    expect(await repo.serie(owner, '2026-08-01', '2026-08-31')).toEqual([]);
  });

  it('no mezcla propietarios', async () => {
    await repo.guardar(punto('2026-08-31', 1n));
    await repo.guardar({ ...punto('2026-08-31', 999n), owner: otro });

    expect((await repo.serie(owner, '2026-08-01', '2026-08-31'))[0]?.patrimonio.amount).toBe(1n);
  });

  /**
   * Como TEXT y no como número: un patrimonio grande en una escala cripto no
   * cabe en el entero de SQLite sin perder dígitos.
   */
  it('un patrimonio enorme no pierde un dígito', async () => {
    const enorme = 123_456_789_012_345_678_901n;
    await repo.guardar(punto('2026-08-31', enorme));

    expect((await repo.serie(owner, '2026-08-01', '2026-08-31'))[0]?.patrimonio.amount).toBe(
      enorme,
    );
  });

  it('un patrimonio negativo se guarda con su signo', async () => {
    await repo.guardar(punto('2026-08-31', -1_814_013n));

    expect((await repo.serie(owner, '2026-08-01', '2026-08-31'))[0]?.patrimonio.amount).toBe(
      -1_814_013n,
    );
  });

  it('guarda con qué tasas se valoró', async () => {
    await repo.guardar(punto('2026-08-31', 1n));

    expect((await repo.serie(owner, '2026-08-01', '2026-08-31'))[0]?.tasas).toContain('TRM');
  });
});
