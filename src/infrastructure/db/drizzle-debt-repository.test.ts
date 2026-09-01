import type { Debt } from '@/domain/debt/debt';
import { accountId, ownerId } from '@/domain/ledger/ids';

import { createDrizzleDebtRepository } from './drizzle-debt-repository';
import { debts } from './schema';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const otro = ownerId('otra-persona');
const prestamo = accountId('prestamo:banco');

const base: Debt = {
  accountId: prestamo,
  owner,
  tipo: 'prestamo',
  nombre: 'Crédito de libre inversión',
  tasa: { valor: 0.24, tipo: 'EA' },
  cuotasTotales: 36,
  diaDePago: 15,
};

describe('DebtRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleDebtRepository>;

  beforeEach(() => {
    cliente = createTestDb();
    repo = createDrizzleDebtRepository(cliente.db);
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda y devuelve los términos de una deuda', async () => {
    await repo.guardar(base);

    expect(await repo.buscar(prestamo)).toEqual(base);
  });

  it('volver a guardar reemplaza, no duplica', async () => {
    await repo.guardar(base);
    await repo.guardar({ ...base, nombre: 'Otro nombre' });

    expect(await repo.listar(owner)).toHaveLength(1);
    expect((await repo.buscar(prestamo))?.nombre).toBe('Otro nombre');
  });

  it('no devuelve las deudas de otro propietario', async () => {
    await repo.guardar(base);
    await repo.guardar({ ...base, accountId: accountId('prestamo:ajeno'), owner: otro });

    expect((await repo.listar(owner)).map((d) => d.accountId)).toEqual([prestamo]);
  });

  /**
   * «0,024» no significa nada sin saber si es efectiva anual o mes vencido, y
   * confundirlas cambia la cuota lo bastante como para que la simulación mienta.
   */
  it('la tasa vuelve con su tipo, no solo con su número', async () => {
    await repo.guardar({ ...base, tasa: { valor: 0.02, tipo: 'MV' } });

    expect((await repo.buscar(prestamo))?.tasa).toEqual({ valor: 0.02, tipo: 'MV' });
  });

  /** `null` es «no aplica»; cero es una tasa pactada del 0 %. */
  it('una deuda sin tasa vuelve con null, no con cero', async () => {
    await repo.guardar({
      ...base,
      tipo: 'persona',
      tasa: null,
      cuotasTotales: null,
      diaDePago: null,
    });

    const leida = await repo.buscar(prestamo);
    expect(leida?.tasa).toBeNull();
    expect(leida?.cuotasTotales).toBeNull();
  });

  it('una tasa cero se guarda como cero, y sigue distinguiéndose de null', async () => {
    await repo.guardar({ ...base, tasa: { valor: 0, tipo: 'EA' } });

    expect((await repo.buscar(prestamo))?.tasa).toEqual({ valor: 0, tipo: 'EA' });
  });

  it('buscar una que no existe devuelve null', async () => {
    expect(await repo.buscar(accountId('no:existe'))).toBeNull();
  });

  it('borrar la quita', async () => {
    await repo.guardar(base);
    await repo.borrar(prestamo);

    expect(await repo.listar(owner)).toEqual([]);
  });

  /**
   * El saldo sale del ledger. Si apareciera aquí habría dos verdades sobre la
   * misma deuda, y la guardada siempre acaba siendo la vieja.
   */
  it('la tabla no declara ninguna columna de saldo', () => {
    const columnas = Object.keys(debts);

    expect(columnas).not.toContain('saldo');
    expect(columnas).not.toContain('deuda');
    expect(columnas.sort()).toEqual([
      'accountId',
      'cuotasTotales',
      'diaDePago',
      'nombre',
      'ownerId',
      'tasaTipo',
      'tasaValor',
      'tipo',
    ]);
  });
});
