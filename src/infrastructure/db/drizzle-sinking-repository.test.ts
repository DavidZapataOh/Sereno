import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import type { SinkingFund } from '@/domain/sinking/sinking-fund';

import { createDrizzleSinkingRepository } from './drizzle-sinking-repository';
import { sinking_funds } from './schema';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const id = accountId('fondo:seguro');

const seguro: SinkingFund = {
  accountId: id,
  owner,
  nombre: 'Seguro del carro',
  tipo: 'gasto',
  objetivo: money(1_200_000, 'COP'),
  proximaFecha: '2027-09-01',
  cadaMeses: 12,
};

describe('SinkingRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleSinkingRepository>;

  beforeEach(() => {
    cliente = createTestDb();
    repo = createDrizzleSinkingRepository(cliente.db);
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda y devuelve un fondo', async () => {
    await repo.guardar(seguro);

    expect(await repo.buscar(id)).toEqual(seguro);
  });

  it('volver a guardar reemplaza, no duplica', async () => {
    await repo.guardar(seguro);
    await repo.guardar({ ...seguro, nombre: 'Otro' });

    expect(await repo.listar(owner)).toHaveLength(1);
  });

  it('no devuelve los fondos de otro propietario', async () => {
    await repo.guardar(seguro);

    expect(await repo.listar(ownerId('otro'))).toEqual([]);
  });

  /** Como TEXT: un objetivo grande no cabe en el entero de SQLite sin perder dígitos. */
  it('un objetivo enorme no pierde un dígito', async () => {
    const enorme = 123_456_789_012_345_678n;
    await repo.guardar({ ...seguro, objetivo: money(enorme, 'COP') });

    expect((await repo.buscar(id))?.objetivo.amount).toBe(enorme);
  });

  it('borrar lo quita', async () => {
    await repo.guardar(seguro);
    await repo.borrar(id);

    expect(await repo.listar(owner)).toEqual([]);
  });

  /**
   * Lo apartado sale del ledger. Si apareciera aquí habría dos verdades sobre
   * el mismo fondo, y la guardada acabaría siendo la vieja.
   */
  it('la tabla no declara ninguna columna de lo apartado', () => {
    const columnas = Object.keys(sinking_funds);

    expect(columnas).not.toContain('apartado');
    expect(columnas).not.toContain('saldo');
  });
});
