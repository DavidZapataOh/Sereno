import { accountId, ownerId, transactionId } from './ids';

describe('identificadores', () => {
  it('conservan el valor original', () => {
    expect(accountId('cuenta-1')).toBe('cuenta-1');
  });

  it('rechazan una cadena vacía', () => {
    expect(() => accountId('')).toThrow();
    expect(() => transactionId('')).toThrow();
    expect(() => ownerId('')).toThrow();
  });

  it('rechazan una cadena de solo espacios', () => {
    expect(() => accountId('   ')).toThrow();
  });
});
