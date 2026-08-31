import { cicloDe } from '@/domain/cards/billing-cycle';
import { transactionId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import type { CycleStatement } from './cycle-statement';
import { verifyCycle } from './verify-cycle';

const ciclo = cicloDe('2026-08-20', 15, 5);
const HOY_DESPUES_DEL_PAGO = '2026-10-10T10:00:00.000-05:00';
const HOY_ANTES_DEL_PAGO = '2026-09-20T10:00:00.000-05:00';

const extracto = (compras: number, pagos: number): CycleStatement => ({
  ciclo,
  compras: money(compras, 'COP'),
  pagos: money(pagos, 'COP'),
  movimientos: [transactionId('t1')],
});

describe('verifyCycle', () => {
  it('al día cuando el pago coincide con lo comprado', () => {
    expect(verifyCycle(extracto(1_200_000, 1_200_000), HOY_DESPUES_DEL_PAGO).veredicto).toBe(
      'al-dia',
    );
  });

  it('sin pago todavía, no dice que algo va mal', () => {
    // El ciclo aún no vence: no hay nada que reprochar.
    expect(verifyCycle(extracto(1_200_000, 0), HOY_ANTES_DEL_PAGO).veredicto).toBe('sin-pago');
  });

  /**
   * Pagar menos de lo comprado **no es un error**: es una compra a cuotas. La
   * diferencia es deuda que sigue viva, y eso es lo que hay que decir.
   */
  it('pagar menos de lo comprado es financiación, no un descuadre', () => {
    const check = verifyCycle(extracto(1_200_000, 100_000), HOY_DESPUES_DEL_PAGO);

    expect(check.veredicto).toBe('financiado');
    expect(check.diferencia.amount).toBe(1_100_000n);
  });

  it('pagar más de lo comprado es abonar a deuda vieja', () => {
    const check = verifyCycle(extracto(100_000, 500_000), HOY_DESPUES_DEL_PAGO);

    expect(check.veredicto).toBe('adelantado');
    expect(check.diferencia.amount).toBe(-400_000n);
  });

  it('una diferencia de unos pesos es redondeo: sigue al día', () => {
    expect(verifyCycle(extracto(45_000, 45_002), HOY_DESPUES_DEL_PAGO).veredicto).toBe('al-dia');
    expect(verifyCycle(extracto(45_002, 45_000), HOY_DESPUES_DEL_PAGO).veredicto).toBe('al-dia');
  });

  it('pasado el día de pago sin haber pagado nada, ya no es «sin pago»', () => {
    // Vencido y sin pagar: eso sí es deuda, y hay que decirlo.
    expect(verifyCycle(extracto(1_200_000, 0), HOY_DESPUES_DEL_PAGO).veredicto).toBe('financiado');
  });

  it('un ciclo sin compras ni pagos está al día', () => {
    expect(verifyCycle(extracto(0, 0), HOY_DESPUES_DEL_PAGO).veredicto).toBe('al-dia');
  });

  it('devuelve el ciclo y las dos cifras, para poder enseñarlas', () => {
    const check = verifyCycle(extracto(1_200_000, 100_000), HOY_DESPUES_DEL_PAGO);

    expect(check.comprado.amount).toBe(1_200_000n);
    expect(check.pagado.amount).toBe(100_000n);
    expect(check.ciclo).toEqual(ciclo);
  });
});
