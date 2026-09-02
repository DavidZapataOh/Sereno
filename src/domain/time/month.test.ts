import { array, assert, integer, property, record } from 'fast-check';

import {
  diasAntes,
  diasDelMes,
  finDeMes,
  mesAnterior,
  mesDe,
  mesSiguiente,
  mesesAntes,
} from './month';

describe('mesAnterior y mesSiguiente', () => {
  it('son inversas', () => {
    assert(
      property(integer({ min: 1970, max: 2100 }), integer({ min: 1, max: 12 }), (anio, mes) => {
        const m = `${String(anio)}-${String(mes).padStart(2, '0')}`;
        expect(mesAnterior(mesSiguiente(m))).toBe(m);
      }),
    );
  });

  it('cruzan el año por los dos lados', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
    expect(mesSiguiente('2026-12')).toBe('2027-01');
  });

  it('rechazan lo que no es un mes', () => {
    for (const malo of ['2026-13', '2026-00', '2026-1', 'agosto', '2026-08-01']) {
      expect(() => mesAnterior(malo)).toThrow(/AAAA-MM/);
    }
  });
});

describe('finDeMes', () => {
  it('es el primer instante del mes siguiente, en hora de Colombia', () => {
    expect(finDeMes('2026-08')).toBe('2026-09-01T00:00:00.000-05:00');
    expect(finDeMes('2026-12')).toBe('2027-01-01T00:00:00.000-05:00');
  });

  it('toda fecha del mes queda por debajo, comparada como texto', () => {
    for (const fecha of ['2026-08-01T00:00:00.000-05:00', '2026-08-31T23:59:59.999-05:00']) {
      expect(fecha < finDeMes('2026-08')).toBe(true);
    }
  });
});

describe('mesesAntes', () => {
  /** El fallo real: dos copias devolvían «2026-02-31», un día que no existe. */
  it('recorta al último día real del mes', () => {
    expect(mesesAntes('2026-03-31', 1)).toBe('2026-02-28');
    expect(mesesAntes('2026-05-31', 1)).toBe('2026-04-30');
  });

  it('respeta los bisiestos', () => {
    expect(mesesAntes('2024-03-31', 1)).toBe('2024-02-29');
    expect(mesesAntes('2100-03-30', 1)).toBe('2100-02-28');
  });

  it('no toca el día cuando cabe', () => {
    expect(mesesAntes('2026-09-15', 3)).toBe('2026-06-15');
  });

  it('cruza el año hacia atrás', () => {
    expect(mesesAntes('2026-01-15', 2)).toBe('2025-11-15');
    expect(mesesAntes('2026-01-31', 13)).toBe('2024-12-31');
  });

  /** La propiedad que evita que vuelva a colarse un día inexistente. */
  it('cualquier fecha que produce es una fecha que existe', () => {
    assert(
      property(
        record({
          anio: integer({ min: 1971, max: 2100 }),
          mes: integer({ min: 1, max: 12 }),
          dia: integer({ min: 1, max: 31 }),
          n: integer({ min: 0, max: 60 }),
        }),
        ({ anio, mes, dia, n }) => {
          const tope = diasDelMes(anio, mes);
          const entrada = `${String(anio)}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, tope)).padStart(2, '0')}`;

          const salida = mesesAntes(entrada, n);
          const [a = 0, m = 0, d = 0] = salida.split('-').map(Number);

          expect(d).toBeGreaterThanOrEqual(1);
          expect(d).toBeLessThanOrEqual(diasDelMes(a, m));
        },
      ),
    );
  });

  it('cero meses antes es el mismo día', () => {
    expect(mesesAntes('2026-09-15', 0)).toBe('2026-09-15');
  });

  it('rechaza lo que no es un día', () => {
    expect(() => mesesAntes('2026-09', 1)).toThrow(/AAAA-MM-DD/);
    expect(() => mesesAntes('2026-02-31', 1)).toThrow(/AAAA-MM-DD/);
  });
});

describe('diasAntes', () => {
  it('cruza meses y años', () => {
    expect(diasAntes('2026-03-01', 1)).toBe('2026-02-28');
    expect(diasAntes('2024-03-01', 1)).toBe('2024-02-29');
    expect(diasAntes('2026-01-01', 1)).toBe('2025-12-31');
  });

  it('cero días antes es el mismo día', () => {
    expect(diasAntes('2026-09-15', 0)).toBe('2026-09-15');
  });

  it('nunca devuelve un día que no exista', () => {
    assert(
      property(array(integer({ min: 0, max: 400 }), { minLength: 1, maxLength: 20 }), (dias) => {
        for (const n of dias) {
          const salida = diasAntes('2026-09-15', n);
          const [a = 0, m = 0, d = 0] = salida.split('-').map(Number);
          expect(d).toBeLessThanOrEqual(diasDelMes(a, m));
        }
      }),
    );
  });
});

describe('diasDelMes', () => {
  it('sabe de febrero y de los bisiestos', () => {
    expect(diasDelMes(2026, 2)).toBe(28);
    expect(diasDelMes(2024, 2)).toBe(29);
    expect(diasDelMes(2000, 2)).toBe(29);
    expect(diasDelMes(1900, 2)).toBe(28);
    expect(diasDelMes(2026, 4)).toBe(30);
  });
});

describe('mesDe', () => {
  it('saca el mes de una fecha del ledger, con o sin hora', () => {
    expect(mesDe('2026-08-31T23:00:00.000-05:00')).toBe('2026-08');
    expect(mesDe('2026-08-31')).toBe('2026-08');
  });
});
