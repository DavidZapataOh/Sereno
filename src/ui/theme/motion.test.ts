import {
  DURACION,
  DURACION_MAXIMA,
  DURACION_MAXIMA_AL_TACTO,
  ESCALA_PRESION,
  RESORTE,
} from './motion';

describe('duraciones', () => {
  /** Por encima de 420 ms se percibe como lentitud, no como suavidad. */
  it('ninguna pasa del techo', () => {
    for (const [nombre, ms] of Object.entries(DURACION)) {
      expect([nombre, ms <= DURACION_MAXIMA]).toEqual([nombre, true]);
    }
  });

  it('lo que responde al dedo baja del techo al tacto', () => {
    expect(DURACION.instante).toBeLessThanOrEqual(DURACION_MAXIMA_AL_TACTO);
    expect(DURACION.rapido).toBeLessThanOrEqual(DURACION_MAXIMA_AL_TACTO);
  });

  it('están ordenadas de menor a mayor', () => {
    const valores = [DURACION.instante, DURACION.rapido, DURACION.normal, DURACION.entrada];
    expect([...valores].sort((a, b) => a - b)).toEqual(valores);
  });
});

describe('muelles', () => {
  /** Un rebote exagerado se lee como juguete, y esto administra dinero. */
  it('ninguno rebota más de lo que rebotaría un objeto real', () => {
    for (const [nombre, resorte] of Object.entries(RESORTE)) {
      // Amortiguación crítica: 2·√(k·m). Por debajo de la mitad, oscila feo.
      const critica = 2 * Math.sqrt(resorte.stiffness * resorte.mass);
      expect([nombre, resorte.damping / critica]).toEqual([
        nombre,
        expect.any(Number) as unknown as number,
      ]);
      expect(resorte.damping / critica).toBeGreaterThan(0.55);
    }
  });

  it('el de presión es el más rígido: el dedo ya está ahí', () => {
    expect(RESORTE.presion.stiffness).toBeGreaterThan(RESORTE.entrada.stiffness);
    expect(RESORTE.presion.stiffness).toBeGreaterThan(RESORTE.arrastre.stiffness);
  });
});

describe('escala de presión', () => {
  it('se hunde lo justo: se nota y no salta', () => {
    expect(ESCALA_PRESION).toBeLessThan(1);
    expect(ESCALA_PRESION).toBeGreaterThanOrEqual(0.94);
  });
});
