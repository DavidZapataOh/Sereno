import { assert, date, integer, property } from 'fast-check';

import { cicloDe, ciclosEntre, contiene } from './billing-cycle';

describe('cicloDe', () => {
  it('una compra a mitad de mes cae en el ciclo que empezó en el corte anterior', () => {
    // Corte el 15, pago el 5.
    expect(cicloDe('2026-08-20', 15, 5)).toEqual({
      corte: '2026-08-15',
      siguienteCorte: '2026-09-15',
      pago: '2026-10-05',
    });
  });

  /**
   * El pago cae **después** del corte que cierra el ciclo: lo que se compra el
   * 20 de agosto cierra el 15 de septiembre y se paga el 5 de octubre. Ponerlo
   * en el mismo mes del cierre adelanta la fecha un mes entero, que es el
   * error que hace que una app avise tarde.
   */
  it('el pago va después del corte que cierra el ciclo', () => {
    const ciclo = cicloDe('2026-08-20', 15, 5);
    expect(ciclo.pago > ciclo.siguienteCorte).toBe(true);
  });

  it('con el día de pago después del de corte, el pago es del mismo mes del cierre', () => {
    // Corte el 5, pago el 20: cierra el 5 de septiembre, se paga el 20 de septiembre.
    expect(cicloDe('2026-08-10', 5, 20)).toEqual({
      corte: '2026-08-05',
      siguienteCorte: '2026-09-05',
      pago: '2026-09-20',
    });
  });

  it('una compra el mismo día del corte entra en el ciclo que abre, no en el que cierra', () => {
    expect(cicloDe('2026-08-15', 15, 5).corte).toBe('2026-08-15');
  });

  it('una compra antes del corte del mes pertenece al ciclo del mes anterior', () => {
    expect(cicloDe('2026-08-14', 15, 5).corte).toBe('2026-07-15');
  });

  it('cruza el fin de año', () => {
    expect(cicloDe('2026-12-20', 15, 5)).toEqual({
      corte: '2026-12-15',
      siguienteCorte: '2027-01-15',
      pago: '2027-02-05',
    });
  });

  it('cruza el fin de año también hacia atrás', () => {
    expect(cicloDe('2027-01-10', 15, 5).corte).toBe('2026-12-15');
  });

  /**
   * Los movimientos llegan como instantes con zona. Un gasto de las 23:00 del
   * 30 en Colombia es `2026-08-31T04:00Z`: cortar la cadena por los diez
   * primeros caracteres lo metería en el ciclo siguiente.
   */
  it('un instante en UTC se interpreta en hora de Colombia', () => {
    expect(cicloDe('2026-08-15T04:00:00.000Z', 15, 5).corte).toBe('2026-07-15');
    expect(cicloDe('2026-08-14T23:00:00.000-05:00', 15, 5).corte).toBe('2026-07-15');
  });
});

describe('contiene', () => {
  const ciclo = cicloDe('2026-08-20', 15, 5);

  it('incluye el día del corte y excluye el siguiente', () => {
    expect(contiene(ciclo, '2026-08-15')).toBe(true);
    expect(contiene(ciclo, '2026-09-14')).toBe(true);
    expect(contiene(ciclo, '2026-09-15')).toBe(false);
    expect(contiene(ciclo, '2026-08-14')).toBe(false);
  });
});

describe('ciclosEntre', () => {
  it('genera los ciclos del rango, encadenados', () => {
    const ciclos = ciclosEntre('2026-01-20', '2026-04-01', 15, 5);

    expect(ciclos.map((c) => c.corte)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('propiedad: los ciclos no se solapan y no dejan huecos', () => {
    assert(
      property(integer({ min: 1, max: 28 }), integer({ min: 1, max: 28 }), (corte, pago) => {
        const ciclos = ciclosEntre('2026-01-01', '2027-12-31', corte, pago);
        return ciclos.every((c, i) => i === 0 || c.corte === ciclos[i - 1]?.siguienteCorte);
      }),
      { numRuns: 300 },
    );
  });

  /**
   * La que garantiza que ninguna compra se pierda ni se cuente dos veces.
   */
  it('propiedad: toda fecha del rango cae en exactamente un ciclo', () => {
    assert(
      property(
        integer({ min: 1, max: 28 }),
        // `noInvalidDate`: fast-check genera `Invalid Date` como caso límite,
        // y eso ya produjo una prueba intermitente en el sprint 00.
        date({ min: new Date('2026-01-01'), max: new Date('2027-06-30'), noInvalidDate: true }),
        (corte, fecha) => {
          const dia = fecha.toISOString().slice(0, 10);
          const ciclos = ciclosEntre('2025-12-01', '2028-01-01', corte, 5);
          return ciclos.filter((c) => contiene(c, dia)).length === 1;
        },
      ),
      { numRuns: 500 },
    );
  });

  /**
   * El pago nunca es anterior al cierre. No es estrictamente posterior: con
   * corte y pago el mismo día —cierra el 1, se paga el 1 del mes siguiente—
   * coinciden, y es un caso válido.
   */
  it('propiedad: el pago nunca cae antes del cierre del ciclo', () => {
    assert(
      property(integer({ min: 1, max: 28 }), integer({ min: 1, max: 28 }), (corte, pago) =>
        ciclosEntre('2026-01-01', '2026-12-31', corte, pago).every(
          (c) => c.pago >= c.siguienteCorte,
        ),
      ),
      { numRuns: 300 },
    );
  });
});
