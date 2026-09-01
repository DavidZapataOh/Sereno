import { assert, integer, property } from 'fast-check';

import { money } from '@/domain/money/money';

import { MAXIMO_MESES, simular } from './payoff';
import type { DeudaEnSimulacion } from './strategy';

const DESDE = '2026-09';

const deuda = (
  id: string,
  saldo: number,
  tasa: number | null,
  minimo = 50_000,
): DeudaEnSimulacion => ({
  id,
  nombre: id,
  saldo: money(saldo, 'COP'),
  tasa: tasa === null ? null : { valor: tasa, tipo: 'EA' },
  minimo: money(minimo, 'COP'),
});

const opciones = (
  presupuesto: number,
  estrategia: 'avalancha' | 'bola-de-nieve' = 'avalancha',
) => ({
  estrategia,
  presupuesto: money(presupuesto, 'COP'),
  desde: DESDE,
});

describe('simular', () => {
  it('una deuda sin intereses se salda en saldo ÷ cuota meses', () => {
    const r = simular([deuda('primo', 300_000, null, 100_000)], opciones(100_000));

    expect(r.estado).toBe('sale');
    if (r.estado !== 'sale') return;
    expect(r.meses).toHaveLength(3);
    expect(r.interesesTotales.amount).toBe(0n);
    expect(r.fechaDeSalida).toBe('2026-11');
  });

  it('con intereses tarda más, y cobra intereses', () => {
    const sin = simular([deuda('a', 1_000_000, null, 100_000)], opciones(100_000));
    const con = simular([deuda('a', 1_000_000, 0.24, 100_000)], opciones(100_000));

    expect(sin.estado).toBe('sale');
    expect(con.estado).toBe('sale');
    if (sin.estado !== 'sale' || con.estado !== 'sale') return;
    expect(con.meses.length).toBeGreaterThan(sin.meses.length);
    expect(con.interesesTotales.amount).toBeGreaterThan(0n);
  });

  /**
   * El caso que hace que la simulación valga algo, y el que más miedo da si
   * sale mal: si el presupuesto no cubre ni los intereses, **la deuda crece** y
   * no se sale nunca. Dibujar una fecha ahí sería mentir sobre lo único que de
   * verdad importa.
   */
  it('si el presupuesto no cubre los intereses, dice que no converge', () => {
    const r = simular([deuda('cara', 10_000_000, 0.3, 10_000)], opciones(10_000));

    expect(r.estado).toBe('no-converge');
  });

  it('no se cuelga: hay tope de meses y se respeta', () => {
    const r = simular([deuda('imposible', 100_000_000, 0.4, 1_000)], opciones(1_000));

    expect(r.estado).toBe('no-converge');
    expect(MAXIMO_MESES).toBeLessThanOrEqual(600);
  });

  /**
   * Lo que hace «bola de nieve» lo que es: la cuota de la deuda que se cierra
   * no se ahorra, se suma al ataque de la siguiente.
   */
  it('al saldar una deuda su cuota se suma al ataque de la siguiente', () => {
    const dos = simular(
      [deuda('chica', 100_000, null, 50_000), deuda('grande', 500_000, null, 50_000)],
      opciones(100_000, 'bola-de-nieve'),
    );

    expect(dos.estado).toBe('sale');
    if (dos.estado !== 'sale') return;
    // 600.000 a 100.000 al mes son seis meses: todo el presupuesto se usa
    // siempre, incluso después de cerrar la chica.
    expect(dos.meses).toHaveLength(6);
  });

  /** Es la propiedad que define la avalancha. Si falla, el orden está mal. */
  it('avalancha nunca cuesta más intereses que bola de nieve', () => {
    const deudas = [
      deuda('cara-grande', 3_000_000, 0.35, 60_000),
      deuda('barata-chica', 500_000, 0.05, 30_000),
      deuda('media', 1_500_000, 0.2, 40_000),
    ];

    const av = simular(deudas, opciones(400_000, 'avalancha'));
    const bn = simular(deudas, opciones(400_000, 'bola-de-nieve'));

    expect(av.estado).toBe('sale');
    expect(bn.estado).toBe('sale');
    if (av.estado !== 'sale' || bn.estado !== 'sale') return;
    expect(av.interesesTotales.amount).toBeLessThanOrEqual(bn.interesesTotales.amount);
  });

  it('propiedad: el saldo total nunca sube cuando el presupuesto cubre de sobra', () => {
    assert(
      property(integer({ min: 100_000, max: 5_000_000 }), (saldo) => {
        const r = simular([deuda('a', saldo, 0.2, 200_000)], opciones(500_000));
        if (r.estado !== 'sale') return true;

        for (let i = 1; i < r.meses.length; i += 1) {
          const previo = r.meses[i - 1]?.saldoTotal.amount ?? 0n;
          const actual = r.meses[i]?.saldoTotal.amount ?? 0n;
          if (actual > previo) return false;
        }
        return true;
      }),
      { numRuns: 500 },
    );
  });

  it('propiedad: el capital pagado iguala la deuda inicial, sin un peso perdido', () => {
    assert(
      property(integer({ min: 50_000, max: 3_000_000 }), (saldo) => {
        const r = simular([deuda('a', saldo, 0.15, 150_000)], opciones(300_000));
        if (r.estado !== 'sale') return true;

        const capital = r.meses
          .flatMap((m) => m.pagos)
          .reduce((acc, p) => acc + p.capital.amount, 0n);
        return capital === BigInt(saldo);
      }),
      { numRuns: 500 },
    );
  });

  it('un abono extra adelanta la fecha, nunca la retrasa', () => {
    const normal = simular([deuda('a', 2_000_000, 0.24, 100_000)], opciones(200_000));
    const conExtra = simular([deuda('a', 2_000_000, 0.24, 100_000)], opciones(400_000));

    expect(normal.estado).toBe('sale');
    expect(conExtra.estado).toBe('sale');
    if (normal.estado !== 'sale' || conExtra.estado !== 'sale') return;
    expect(conExtra.meses.length).toBeLessThanOrEqual(normal.meses.length);
  });

  it('sin deudas devuelve una salida hoy, no un error', () => {
    const r = simular([], opciones(100_000));

    expect(r.estado).toBe('sale');
    if (r.estado !== 'sale') return;
    expect(r.meses).toEqual([]);
    expect(r.fechaDeSalida).toBe(DESDE);
  });

  it('los meses salen encadenados y cruzan el fin de año', () => {
    const r = simular([deuda('a', 500_000, null, 100_000)], {
      ...opciones(100_000),
      desde: '2026-11',
    });

    expect(r.estado).toBe('sale');
    if (r.estado !== 'sale') return;
    expect(r.meses.map((m) => m.mes)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
    ]);
  });
});
