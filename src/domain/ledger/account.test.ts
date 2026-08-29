import { createAccount, increasesWithDebit, isRealAccount, type AccountKind } from './account';
import { accountId, ownerId } from './ids';

const base = {
  id: accountId('cuenta-1'),
  owner: ownerId('david'),
  nombre: 'Bancolombia Ahorros',
  currency: 'COP' as const,
};

describe('createAccount', () => {
  it('crea una cuenta de activo', () => {
    const cuenta = createAccount({ ...base, kind: 'activo' });
    expect(cuenta.kind).toBe('activo');
    expect(cuenta.archivedAt).toBeNull();
  });

  it('rechaza un nombre vacío', () => {
    expect(() => createAccount({ ...base, kind: 'activo', nombre: '  ' })).toThrow();
  });

  it('conserva el propietario', () => {
    expect(createAccount({ ...base, kind: 'activo' }).owner).toBe('david');
  });

  it('recorta el nombre', () => {
    expect(createAccount({ ...base, kind: 'activo', nombre: '  Ahorros  ' }).nombre).toBe(
      'Ahorros',
    );
  });
});

describe('increasesWithDebit', () => {
  it.each<[AccountKind, boolean]>([
    ['activo', true],
    ['gasto', true],
    ['pasivo', false],
    ['ingreso', false],
    ['patrimonio', false],
  ])('%s aumenta con débito: %s', (kind, esperado) => {
    expect(increasesWithDebit(kind)).toBe(esperado);
  });
});

describe('isRealAccount', () => {
  it('activo y pasivo son cuentas reales: tienen saldo', () => {
    expect(isRealAccount('activo')).toBe(true);
    expect(isRealAccount('pasivo')).toBe(true);
  });

  it('ingreso y gasto son cuentas de resultado: miden flujo, no saldo', () => {
    expect(isRealAccount('ingreso')).toBe(false);
    expect(isRealAccount('gasto')).toBe(false);
  });
});

describe('naturaleza de las cuentas del proyecto', () => {
  it('una tarjeta de crédito es un pasivo, no un activo', () => {
    const tarjeta = createAccount({ ...base, kind: 'pasivo', nombre: 'Nu' });
    expect(isRealAccount(tarjeta.kind)).toBe(true);
    expect(increasesWithDebit(tarjeta.kind)).toBe(false);
  });

  it('el efectivo es una cuenta de activo como cualquier otra', () => {
    expect(createAccount({ ...base, kind: 'activo', nombre: 'Efectivo' }).kind).toBe('activo');
  });
});
