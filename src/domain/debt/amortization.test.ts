import { money } from '@/domain/money/money';

import { necesarioParaSaldar, repartir } from './amortization';

const COP = 'COP' as const;

describe('repartir', () => {
  /**
   * El interés se calcula sobre el saldo, y lo que sobra baja la deuda. Es lo
   * que hace que pagar deuda **no** sea empobrecerse: solo la parte de
   * intereses es gasto; el capital es mover plata de un lado a otro.
   */
  it('el interés sale del saldo y el resto es capital', () => {
    const r = repartir(money(1_000_000, COP), 0.02, money(100_000, COP));

    expect(r.intereses).toEqual(money(20_000, COP));
    expect(r.capital).toEqual(money(80_000, COP));
  });

  /**
   * Redondear cada pata por separado deja un peso suelto que descuadra el
   * asiento. El capital se calcula **por diferencia**, no con su propia
   * fórmula, y por eso esto se cumple siempre.
   */
  it('las dos patas suman exactamente el pago: no se pierde ni un peso', () => {
    for (const pago of [1n, 7n, 99_999n, 1_234_567n]) {
      for (const tasa of [0.0181, 0.02, 0.0234567]) {
        const r = repartir(money(3_333_333, COP), tasa, money(pago, COP));
        expect(r.intereses.amount + r.capital.amount).toBe(pago);
      }
    }
  });

  it('sin tasa no hay intereses: todo es capital', () => {
    const r = repartir(money(1_000_000, COP), 0, money(100_000, COP));

    expect(r.intereses.amount).toBe(0n);
    expect(r.capital).toEqual(money(100_000, COP));
  });

  /**
   * Pagar menos que el interés del mes es deuda que **crece**. No es un error
   * y no se puede esconder: es exactamente lo que hay que enseñarle a alguien
   * que solo paga el mínimo.
   */
  it('un pago menor que el interés deja capital negativo, y no se recorta a cero', () => {
    const r = repartir(money(1_000_000, COP), 0.02, money(10_000, COP));

    expect(r.intereses).toEqual(money(20_000, COP));
    expect(r.capital.amount).toBe(-10_000n);
  });

  it('sobre un saldo cero no hay intereses', () => {
    const r = repartir(money(0, COP), 0.02, money(50_000, COP));

    expect(r.intereses.amount).toBe(0n);
    expect(r.capital).toEqual(money(50_000, COP));
  });

  /**
   * El redondeo va contra el deudor —hacia arriba en los intereses— y está
   * declarado. Un redondeo a favor haría que la simulación prometiera salir
   * antes de lo que se sale, que es la mentira que más duele.
   */
  it('el redondeo de los intereses no se queda corto', () => {
    // 0,5 % de 999 son 4,995 pesos: se cobran 5, no 4.
    const r = repartir(money(999, COP), 0.005, money(500, COP));

    expect(r.intereses.amount).toBe(5n);
  });

  it('no mezcla monedas', () => {
    expect(() => repartir(money(1_000, COP), 0.02, money(100, 'USDC'))).toThrow();
  });

  /**
   * En el ledger un pasivo tiene saldo negativo. Aceptarlo aquí daría
   * intereses negativos —la deuda pagándole a uno— sin que nada se quejara.
   */
  it('rechaza un saldo negativo en vez de calcular intereses al revés', () => {
    expect(() => repartir(money(-1_000_000, COP), 0.02, money(100_000, COP))).toThrow(/positivo/i);
  });

  it('rechaza una tasa negativa: eso no es una deuda', () => {
    expect(() => repartir(money(1_000, COP), -0.01, money(100, COP))).toThrow(/negativa/i);
  });
});

describe('necesarioParaSaldar', () => {
  /**
   * El bug que hizo que la simulación declarara «no converge» sobre una deuda
   * perfectamente pagable: topar el pago al saldo hace que la deuda baje
   * siempre un poco menos de lo que se paga, y se acerque a cero sin llegar.
   */
  it('es el saldo más los intereses del mes, no el saldo', () => {
    const saldo = money(1_000_000, COP);

    expect(necesarioParaSaldar(saldo, 0.02).amount).toBe(1_020_000n);
  });

  it('pagando eso, la deuda queda exactamente en cero', () => {
    const saldo = money(1_000_000, COP);
    const pago = necesarioParaSaldar(saldo, 0.02);
    const { capital } = repartir(saldo, 0.02, pago);

    expect(saldo.amount - capital.amount).toBe(0n);
  });

  it('sin intereses es el saldo tal cual', () => {
    expect(necesarioParaSaldar(money(500_000, COP), 0).amount).toBe(500_000n);
  });
});
