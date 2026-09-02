import { agruparPorDia, type ConFechaYMonto } from './group-by-day';

const HOY = '2026-09-02T10:00:00.000-05:00';

const mov = (fecha: string, amount: bigint, direction: ConFechaYMonto['direction'] = 'sale') => ({
  fecha,
  monto: { amount },
  direction,
});

describe('agruparPorDia', () => {
  it('parte por día y conserva el orden que venía', () => {
    const dias = agruparPorDia(
      [
        mov('2026-09-02T14:00:00.000-05:00', 10_000n),
        mov('2026-09-02T09:00:00.000-05:00', 5_000n),
        mov('2026-09-01T09:00:00.000-05:00', 3_000n),
      ],
      HOY,
    );

    expect(dias.map((d) => d.dia)).toEqual(['2026-09-02', '2026-09-01']);
    expect(dias[0]?.movimientos).toHaveLength(2);
  });

  it('hoy y ayer se llaman por su nombre', () => {
    const dias = agruparPorDia(
      [mov('2026-09-02T09:00:00.000-05:00', 1n), mov('2026-09-01T09:00:00.000-05:00', 1n)],
      HOY,
    );

    expect(dias.map((d) => d.titulo)).toEqual(['Hoy', 'Ayer']);
  });

  it('lo demás lleva su fecha corta, no «hace tres días»', () => {
    const dias = agruparPorDia([mov('2026-08-28T09:00:00.000-05:00', 1n)], HOY);

    expect(dias[0]?.titulo).toMatch(/28/);
  });

  /** Sumar las entradas daría una cifra que no significa nada. */
  it('el total del día es solo lo que salió', () => {
    const dias = agruparPorDia(
      [
        mov('2026-09-02T14:00:00.000-05:00', 10_000n),
        mov('2026-09-02T13:00:00.000-05:00', 900_000n, 'entra'),
        mov('2026-09-02T12:00:00.000-05:00', 50_000n, 'neutro'),
      ],
      HOY,
    );

    expect(dias[0]?.gastado).toBe(10_000n);
  });

  it('un monto negativo cuenta por su valor', () => {
    const dias = agruparPorDia([mov('2026-09-02T14:00:00.000-05:00', -10_000n)], HOY);

    expect(dias[0]?.gastado).toBe(10_000n);
  });

  it('sin movimientos no inventa días', () => {
    expect(agruparPorDia([], HOY)).toEqual([]);
  });

  /** Un movimiento de las 23:30 en Colombia es de ese día, no del siguiente. */
  it('el día es el de Colombia, no el UTC', () => {
    const dias = agruparPorDia([mov('2026-09-02T23:30:00.000-05:00', 1n)], HOY);

    expect(dias[0]?.dia).toBe('2026-09-02');
  });
});
