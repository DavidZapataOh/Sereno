import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';

import { createClassification, type Classification } from './classification';

const base: Classification = {
  transactionId: transactionId('bancolombia:C1'),
  owner: ownerId('david'),
  categoria: accountId('categoria:mercado'),
  origen: 'aprendida',
  reglaId: null,
  confianza: 63,
  clasificadoEn: '2026-08-30T10:00:00.000-05:00',
};

describe('createClassification', () => {
  it('acepta una clasificación aprendida con su confianza', () => {
    expect(createClassification(base)).toEqual(base);
  });

  it('la confianza es un entero de 0 a 100', () => {
    expect(() => createClassification({ ...base, confianza: 101 })).toThrow(/0 a 100/);
    expect(() => createClassification({ ...base, confianza: -1 })).toThrow(/0 a 100/);
    expect(() => createClassification({ ...base, confianza: 50.5 })).toThrow(/0 a 100/);
  });

  it('lo que decide el usuario va con 100', () => {
    expect(() => createClassification({ ...base, origen: 'manual', confianza: 80 })).toThrow(/100/);
    expect(createClassification({ ...base, origen: 'manual', confianza: 100 }).origen).toBe(
      'manual',
    );
  });

  it('una regla dice qué regla', () => {
    expect(() =>
      createClassification({ ...base, origen: 'regla', confianza: 100, reglaId: null }),
    ).toThrow(/regla/);
  });
});
