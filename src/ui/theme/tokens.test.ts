import { DURATION, ELEVATION, RADIUS, SPACING, TOUCH_TARGET_MIN } from './tokens';

describe('SPACING', () => {
  it('sigue una escala de base 4', () => {
    Object.values(SPACING).forEach((valor) => {
      expect(valor % 4).toBe(0);
    });
  });

  it('es estrictamente creciente', () => {
    const valores = Object.values(SPACING);
    expect(valores).toEqual([...valores].sort((a, b) => a - b));
    expect(new Set(valores).size).toBe(valores.length);
  });
});

describe('TOUCH_TARGET_MIN', () => {
  it('cumple el mínimo de Android de 48dp', () => {
    expect(TOUCH_TARGET_MIN).toBeGreaterThanOrEqual(48);
  });
});

describe('RADIUS', () => {
  it('define los radios esperados', () => {
    expect(Object.keys(RADIUS).sort()).toEqual(['completo', 'grande', 'medio', 'pequeno'].sort());
  });

  it('el radio completo es suficiente para un círculo', () => {
    expect(RADIUS.completo).toBeGreaterThanOrEqual(999);
  });

  it('los radios crecen en el orden declarado', () => {
    expect(RADIUS.pequeno).toBeLessThan(RADIUS.medio);
    expect(RADIUS.medio).toBeLessThan(RADIUS.grande);
  });
});

describe('DURATION', () => {
  it('ninguna animación supera los 400 ms', () => {
    // Principio 3: el movimiento explica, no entretiene.
    Object.values(DURATION).forEach((valor) => {
      expect(valor).toBeLessThanOrEqual(400);
    });
  });

  it('ninguna baja de 80 ms: por debajo no se percibe y solo cuesta batería', () => {
    Object.values(DURATION).forEach((valor) => {
      expect(valor).toBeGreaterThanOrEqual(80);
    });
  });
});

describe('ELEVATION', () => {
  it('define niveles crecientes desde cero', () => {
    expect(ELEVATION.plano).toBe(0);
    expect(ELEVATION.elevado).toBeGreaterThan(ELEVATION.plano);
    expect(ELEVATION.flotante).toBeGreaterThan(ELEVATION.elevado);
  });
});
