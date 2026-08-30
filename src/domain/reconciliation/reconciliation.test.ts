import { money } from '@/domain/money/money';

import { reconcile } from './reconciliation';

describe('reconcile', () => {
  it('cuadra cuando real y calculado coinciden', () => {
    const r = reconcile({ saldoReal: money(1000, 'COP'), saldoCalculado: money(1000, 'COP') });
    expect(r.veredicto).toBe('cuadra');
    expect(r.diferencia.amount).toBe(0n);
  });

  it('si el banco tiene menos de lo que el ledger cree, hay gasto que no entró', () => {
    // El ledger dice 1.000.000; el banco, 955.000. Salieron 45.000 que nadie vio.
    const r = reconcile({
      saldoReal: money(955000, 'COP'),
      saldoCalculado: money(1000000, 'COP'),
    });
    expect(r.veredicto).toBe('gasto-no-capturado');
    expect(r.diferencia.amount).toBe(-45000n);
  });

  it('si el banco tiene más, hay ingreso que no entró', () => {
    const r = reconcile({
      saldoReal: money(1200000, 'COP'),
      saldoCalculado: money(1000000, 'COP'),
    });
    expect(r.veredicto).toBe('ingreso-no-capturado');
    expect(r.diferencia.amount).toBe(200000n);
  });

  it('la diferencia es real menos calculado, sin redondear', () => {
    // Principio 5: un peso de diferencia es un peso de diferencia.
    const r = reconcile({
      saldoReal: money(1000001, 'COP'),
      saldoCalculado: money(1000000, 'COP'),
    });
    expect(r.veredicto).toBe('ingreso-no-capturado');
    expect(r.diferencia.amount).toBe(1n);
  });

  it('rechaza monedas distintas', () => {
    expect(() =>
      reconcile({ saldoReal: money(1, 'USD'), saldoCalculado: money(1, 'COP') }),
    ).toThrow();
  });
});
