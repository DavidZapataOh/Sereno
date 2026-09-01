import { assert, integer, property } from 'fast-check';

import { money } from '@/domain/money/money';

import { MAXIMO_MESES, mesVacio, proyectar, salida, type FlujoDelMes } from './projection';

const COP = 'COP' as const;

const flujo = (mes: string, comprometido: number, estimado: number): FlujoDelMes => ({
  mes,
  comprometido: money(comprometido, COP),
  estimado: money(estimado, COP),
});

const MESES = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02'];

describe('proyectar', () => {
  it('el saldo final de un mes es el inicial del siguiente', () => {
    const p = proyectar(
      money(1_000_000, COP),
      [flujo('2026-09', -200_000, -100_000), flujo('2026-10', -200_000, -100_000)],
      { meses: 2 },
    );

    expect(p.meses[0]?.saldoFinal.amount).toBe(700_000n);
    expect(p.meses[1]?.saldoInicial.amount).toBe(700_000n);
    expect(p.meses[1]?.saldoFinal.amount).toBe(400_000n);
  });

  /**
   * La regla que sostiene la pantalla: un número que mezcla un hecho con una
   * suposición parece un hecho.
   */
  it('lo comprometido y lo estimado se devuelven por separado', () => {
    const p = proyectar(money(1_000_000, COP), [flujo('2026-09', -200_000, -100_000)], {
      meses: 1,
    });

    expect(p.meses[0]?.comprometido.amount).toBe(-200_000n);
    expect(p.meses[0]?.estimado.amount).toBe(-100_000n);
  });

  it('encuentra el primer mes en que el saldo no alcanza', () => {
    const p = proyectar(
      money(500_000, COP),
      [flujo('2026-09', -200_000, 0), flujo('2026-10', -200_000, 0), flujo('2026-11', -200_000, 0)],
      { meses: 3 },
    );

    expect(p.primerMesEnRojo).toBe('2026-11');
  });

  /**
   * Avisar por lo estimado dispararía alarmas por algo que quizá no pasa, y el
   * segundo aviso falso desactiva todos los demás.
   */
  it('el aviso sale de lo comprometido, no de lo estimado', () => {
    const p = proyectar(
      money(500_000, COP),
      [flujo('2026-09', -100_000, -900_000), flujo('2026-10', -100_000, -900_000)],
      { meses: 2 },
    );

    // El saldo proyectado sí baja de cero, pero lo comprometido aguanta.
    expect(p.meses[1]?.saldoFinal.amount).toBeLessThan(0n);
    expect(p.primerMesEnRojo).toBeNull();
  });

  it('sin nada en rojo, el primer mes en rojo es null', () => {
    expect(
      proyectar(money(1_000_000, COP), [flujo('2026-09', 0, 0)], { meses: 1 }).primerMesEnRojo,
    ).toBeNull();
  });

  it('respeta el número de meses pedido', () => {
    const flujos = MESES.map((m) => flujo(m, -10_000, 0));

    expect(proyectar(money(1_000_000, COP), flujos, { meses: 3 }).meses).toHaveLength(3);
  });

  it('no proyecta más allá del tope, aunque se pidan más', () => {
    const muchos = Array.from({ length: 100 }, (_, i) => flujo(`20${String(30 + i)}-01`, 0, 0));

    expect(proyectar(money(0, COP), muchos, { meses: 100 }).meses.length).toBeLessThanOrEqual(
      MAXIMO_MESES,
    );
  });

  it('sin flujos devuelve una proyección vacía, no un error', () => {
    expect(proyectar(money(1_000_000, COP), [], { meses: 6 })).toEqual({
      meses: [],
      primerMesEnRojo: null,
    });
  });

  it('propiedad: sin compromisos ni estimaciones, el saldo no cambia', () => {
    assert(
      property(integer({ min: -10_000_000, max: 10_000_000 }), (saldo) => {
        const p = proyectar(
          money(saldo, COP),
          MESES.map((m) => mesVacio(m, COP)),
          { meses: 6 },
        );
        return p.meses.every((m) => m.saldoFinal.amount === BigInt(saldo));
      }),
      { numRuns: 500 },
    );
  });

  it('propiedad: el saldo final acumula exactamente lo que entra y sale', () => {
    assert(
      property(integer({ min: -500_000, max: 500_000 }), (porMes) => {
        const flujos = MESES.map((m) => flujo(m, porMes, 0));
        const p = proyectar(money(1_000_000, COP), flujos, { meses: 6 });
        const ultimo = p.meses.at(-1)?.saldoFinal.amount ?? 0n;
        return ultimo === 1_000_000n + BigInt(porMes) * 6n;
      }),
      { numRuns: 500 },
    );
  });
});

describe('salida', () => {
  it('convierte un monto en su salida', () => {
    expect(salida(money(100_000, COP)).amount).toBe(-100_000n);
  });
});
