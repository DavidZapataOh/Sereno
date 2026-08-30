import { ownerId } from '@/domain/ledger/ids';
import { SYSTEM_ACCOUNT_KEYS, systemAccountId } from '@/domain/ledger/system-accounts';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { mustExist } from '@/test/must-exist';

import { ensureSourceAccount, ensureSystemAccounts } from './ensure-system-accounts';

const owner = ownerId('david');

describe('ensureSystemAccounts', () => {
  it('crea las cuatro cuentas cuando no existe ninguna', async () => {
    const cuentas = createInMemoryAccountRepository();
    await ensureSystemAccounts(cuentas, owner);
    expect(
      cuentas
        .all()
        .map((c) => c.id)
        .sort(),
    ).toEqual(SYSTEM_ACCOUNT_KEYS.map(systemAccountId).sort());
  });

  it('es idempotente: la segunda vez no toca nada', async () => {
    const cuentas = createInMemoryAccountRepository();
    await ensureSystemAccounts(cuentas, owner);
    const antes = cuentas.all();
    await ensureSystemAccounts(cuentas, owner);
    expect(cuentas.all()).toEqual(antes);
  });

  it('no sobreescribe una cuenta del sistema que el usuario haya renombrado', async () => {
    const cuentas = createInMemoryAccountRepository();
    await ensureSystemAccounts(cuentas, owner);
    const efectivo = mustExist(cuentas.all().find((c) => c.id === systemAccountId('efectivo')));
    await cuentas.save({ ...efectivo, nombre: 'Billetera' });

    await ensureSystemAccounts(cuentas, owner);

    expect(cuentas.all().find((c) => c.id === systemAccountId('efectivo'))?.nombre).toBe(
      'Billetera',
    );
  });
});

describe('ensureSourceAccount', () => {
  it('crea la cuenta de activo de la fuente y devuelve su id', async () => {
    const cuentas = createInMemoryAccountRepository();
    const id = await ensureSourceAccount(cuentas, owner, {
      fuente: 'bancolombia',
      nombre: 'Bancolombia',
    });

    expect(id).toBe('bancolombia:ahorros');
    const cuenta = cuentas.all().find((c) => c.id === id);
    expect(cuenta?.kind).toBe('activo');
    expect(cuenta?.currency).toBe('COP');
  });

  it('no la duplica si ya existe', async () => {
    const cuentas = createInMemoryAccountRepository();
    await ensureSourceAccount(cuentas, owner, { fuente: 'bancolombia', nombre: 'Bancolombia' });
    await ensureSourceAccount(cuentas, owner, { fuente: 'bancolombia', nombre: 'Otro nombre' });

    expect(cuentas.all()).toHaveLength(1);
    expect(cuentas.all()[0]?.nombre).toBe('Bancolombia');
  });

  it('la cuenta de una tarjeta de crédito se crea como pasivo', async () => {
    // Si se creara como activo, el patrimonio saldría al revés y nadie se
    // enteraría: una deuda sumaría en vez de restar.
    const cuentas = createInMemoryAccountRepository();
    const id = await ensureSourceAccount(cuentas, owner, { fuente: 'nu' });

    expect(id).toBe('nu:tarjeta');
    expect(cuentas.all()[0]).toMatchObject({ kind: 'pasivo', nombre: 'Nu' });
  });

  it('sin nombre, usa el del registro de fuentes', async () => {
    const cuentas = createInMemoryAccountRepository();
    await ensureSourceAccount(cuentas, owner, { fuente: 'rappicard' });
    expect(cuentas.all()[0]).toMatchObject({ id: 'rappicard:tarjeta', nombre: 'RappiCard' });
  });
});
