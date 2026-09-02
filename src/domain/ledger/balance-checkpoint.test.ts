import { accountId } from './ids';
import { money } from '@/domain/money/money';

import { finDeMes as limiteDe, mesDe } from '@/domain/time/month';

import { balanceCheckpoint, mesUtilizableHasta } from './balance-checkpoint';

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

describe('mesUtilizableHasta', () => {
  /**
   * Un corte vale hasta la frontera de su mes: si «hasta» cae dentro del mes,
   * ese mes todavía no ha cerrado y hay que quedarse en el anterior.
   */
  it('dentro del mes, sirve el corte del mes anterior', () => {
    expect(mesUtilizableHasta('2026-08-15T10:00:00.000-05:00')).toBe('2026-07');
  });

  it('justo en la frontera, el mes ya cerró y su corte sirve entero', () => {
    expect(mesUtilizableHasta('2026-09-01T00:00:00.000-05:00')).toBe('2026-08');
  });

  it('cruza el año hacia atrás', () => {
    expect(mesUtilizableHasta('2026-01-05T10:00:00.000-05:00')).toBe('2025-12');
  });
});
