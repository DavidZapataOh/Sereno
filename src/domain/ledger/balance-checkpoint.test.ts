import { accountId } from './ids';
import { money } from '@/domain/money/money';

import { balanceCheckpoint, limiteDe, mesAntesDe, mesDe, mesDespuesDe } from './balance-checkpoint';

describe('balanceCheckpoint', () => {
  const base = {
    accountId: accountId('banco'),
    mes: '2026-08',
    saldo: money(1000n, 'COP'),
    calculadoEn: '2026-09-01T10:00:00.000-05:00',
  };

  it('acepta un mes bien escrito', () => {
    expect(balanceCheckpoint(base).mes).toBe('2026-08');
  });

  it('rechaza cualquier cosa que no sea AAAA-MM', () => {
    for (const mes of ['2026-8', '2026-13', '2026-00', '2026-08-01', 'agosto']) {
      expect(() => balanceCheckpoint({ ...base, mes })).toThrow(/AAAA-MM/);
    }
  });
});

describe('limiteDe', () => {
  /**
   * La frontera se compara como texto, igual que hace el repositorio con
   * `transactions.fecha`. Es lo que hace que el corte y el cálculo desde cero
   * partan el mismo conjunto de apuntes.
   */
  it('es el primer instante del mes siguiente', () => {
    expect(limiteDe('2026-08')).toBe('2026-09-01T00:00:00.000-05:00');
  });

  it('diciembre pasa al año siguiente', () => {
    expect(limiteDe('2026-12')).toBe('2027-01-01T00:00:00.000-05:00');
  });

  it('toda fecha del mes queda por debajo de su propia frontera', () => {
    for (const fecha of [
      '2026-08-01T00:00:00.000-05:00',
      '2026-08-31T23:59:59.999-05:00',
      '2026-08-31T23:00:00.000Z',
    ]) {
      expect(fecha < limiteDe(mesDe(fecha))).toBe(true);
    }
  });

  it('ninguna fecha del mes siguiente queda por debajo', () => {
    expect('2026-09-01T00:00:00.001-05:00' > limiteDe('2026-08')).toBe(true);
  });
});

describe('mesAntesDe y mesDespuesDe', () => {
  it('son inversas', () => {
    for (const mes of ['2026-01', '2026-08', '2026-12']) {
      expect(mesAntesDe(mesDespuesDe(mes))).toBe(mes);
      expect(mesDespuesDe(mesAntesDe(mes))).toBe(mes);
    }
  });

  it('cruzan el año por los dos lados', () => {
    expect(mesAntesDe('2026-01')).toBe('2025-12');
    expect(mesDespuesDe('2026-12')).toBe('2027-01');
  });

  it('rechazan un mes mal escrito en vez de devolver algo raro', () => {
    expect(() => mesAntesDe('2026-13')).toThrow(/AAAA-MM/);
    expect(() => mesDespuesDe('nada')).toThrow(/AAAA-MM/);
  });
});
