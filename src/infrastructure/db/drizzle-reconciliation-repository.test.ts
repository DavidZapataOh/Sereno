import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import type { Reconciliation } from '@/domain/reconciliation/reconciliation';
import { mustExist } from '@/test/must-exist';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleReconciliationRepository } from './drizzle-reconciliation-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');

const conciliacion = (
  id: string,
  fecha: string,
  extra: Partial<Reconciliation> = {},
): Reconciliation => ({
  id,
  owner,
  accountId: ahorros,
  fecha,
  saldoReal: money(955000, 'COP'),
  saldoCalculado: money(1000000, 'COP'),
  diferencia: money(-45000, 'COP'),
  veredicto: 'gasto-no-capturado',
  fuente: 'bancolombia',
  detalle: 'Ahorros ****8901',
  creadoEn: fecha,
  ...extra,
});

describe('ReconciliationRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleReconciliationRepository>;

  beforeEach(async () => {
    cliente = createTestDb();
    repo = createDrizzleReconciliationRepository(cliente.db);
    await createDrizzleAccountRepository(cliente.db).save(
      createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
    );
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda y recupera por id con los tres montos y el veredicto', async () => {
    await repo.save(conciliacion('r1', '2026-08-28T10:00:00.000-05:00'));

    const leida = mustExist(await repo.findById('r1'));
    expect(leida.saldoReal).toEqual(money(955000, 'COP'));
    expect(leida.saldoCalculado).toEqual(money(1000000, 'COP'));
    expect(leida.diferencia).toEqual(money(-45000, 'COP'));
    expect(leida.veredicto).toBe('gasto-no-capturado');
    expect(leida.detalle).toBe('Ahorros ****8901');
  });

  it('la última conciliación de una cuenta es la de fecha mayor, no la guardada de último', async () => {
    await repo.save(conciliacion('nueva', '2026-08-28T10:00:00.000-05:00'));
    await repo.save(conciliacion('vieja', '2026-08-20T10:00:00.000-05:00'));

    expect(mustExist(await repo.findLatest(ahorros)).id).toBe('nueva');
  });

  it('con la misma fecha, la última es la registrada de último: la que cierra un ajuste', async () => {
    const fecha = '2026-08-28T10:00:00.000-05:00';
    await repo.save(conciliacion('captura', fecha, { creadoEn: '2026-08-28T10:00:01.000-05:00' }));
    await repo.save(
      conciliacion('ajuste', fecha, {
        veredicto: 'cuadra',
        fuente: 'ajuste',
        creadoEn: '2026-08-28T10:00:02.000-05:00',
      }),
    );

    expect(mustExist(await repo.findLatest(ahorros)).id).toBe('ajuste');
  });

  it('lista por cuenta en orden descendente de fecha', async () => {
    await repo.save(conciliacion('a', '2026-08-20T10:00:00.000-05:00'));
    await repo.save(conciliacion('b', '2026-08-28T10:00:00.000-05:00'));
    await repo.save(conciliacion('c', '2026-08-24T10:00:00.000-05:00'));

    expect((await repo.listByAccount(ahorros)).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('conserva montos que desbordan un entero de 64 bits', async () => {
    const enorme = money(10n ** 19n + 1n, 'COP');
    await repo.save(
      conciliacion('r1', '2026-08-28T10:00:00.000-05:00', {
        saldoReal: enorme,
        saldoCalculado: money(0, 'COP'),
        diferencia: enorme,
        veredicto: 'ingreso-no-capturado',
      }),
    );

    expect(mustExist(await repo.findById('r1')).saldoReal.amount).toBe(10n ** 19n + 1n);
  });

  it('rechaza una conciliación contra una cuenta inexistente', async () => {
    await expect(
      repo.save(
        conciliacion('r1', '2026-08-28T10:00:00.000-05:00', { accountId: accountId('fantasma') }),
      ),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });

  it('findLatest y findById son null cuando no hay nada', async () => {
    expect(await repo.findLatest(ahorros)).toBeNull();
    expect(await repo.findById('nada')).toBeNull();
  });
});
