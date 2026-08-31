import { cadenciaDe, diasDe } from './cadence';

describe('cadenciaDe', () => {
  it('reconoce lo mensual aunque el día se mueva un poco', () => {
    // Los cobros no caen el mismo día: caen el 5, el 4, el 6.
    expect(cadenciaDe(['2026-05-05', '2026-06-04', '2026-07-06', '2026-08-05'])?.cadencia).toBe(
      'mensual',
    );
  });

  it('reconoce lo anual', () => {
    expect(cadenciaDe(['2024-03-10', '2025-03-11', '2026-03-09'])?.cadencia).toBe('anual');
  });

  it('reconoce lo quincenal', () => {
    expect(cadenciaDe(['2026-08-01', '2026-08-16', '2026-08-31'])?.cadencia).toBe('quincenal');
  });

  it('reconoce lo trimestral', () => {
    expect(cadenciaDe(['2026-01-10', '2026-04-11', '2026-07-10'])?.cadencia).toBe('trimestral');
  });

  /**
   * Dos cobros no son una suscripción: son dos cobros. Con dos puntos
   * cualquier periodo «encaja», porque la distancia entre ellos es el periodo
   * por definición.
   */
  it('con menos de tres fechas no dice nada', () => {
    expect(cadenciaDe(['2026-07-05', '2026-08-05'])).toBeNull();
    expect(cadenciaDe(['2026-08-05'])).toBeNull();
    expect(cadenciaDe([])).toBeNull();
  });

  it('unas compras sueltas en el mismo sitio no son una suscripción', () => {
    // Tres cafés en la misma cafetería, sin ritmo.
    expect(cadenciaDe(['2026-08-03', '2026-08-04', '2026-08-19'])).toBeNull();
  });

  it('una serie casi mensual con un salto grande no cuela', () => {
    // El promedio daría «mensual»; los intervalos, no. Se piden todos.
    expect(cadenciaDe(['2026-01-05', '2026-02-05', '2026-08-05'])).toBeNull();
  });

  it('dos cobros el mismo día no son un periodo', () => {
    expect(cadenciaDe(['2026-08-05', '2026-08-05', '2026-09-05'])).toBeNull();
  });

  it('el orden de las fechas no importa', () => {
    expect(cadenciaDe(['2026-07-06', '2026-05-05', '2026-06-04'])?.cadencia).toBe('mensual');
  });

  describe('confianza', () => {
    it('intervalos clavados dan confianza máxima', () => {
      // 30 días exactos entre cada uno.
      expect(cadenciaDe(['2026-01-01', '2026-01-31', '2026-03-02'])?.confianza).toBeCloseTo(1, 5);
    });

    it('en el límite de la tolerancia, la confianza baja', () => {
      const r = cadenciaDe(['2026-05-05', '2026-06-08', '2026-07-08']);
      expect(r?.cadencia).toBe('mensual');
      expect(r?.confianza).toBeLessThan(0.5);
    });
  });
});

describe('diasDe', () => {
  it('devuelve el periodo en días', () => {
    expect(diasDe('mensual')).toBe(30);
    expect(diasDe('anual')).toBe(365);
  });
});
