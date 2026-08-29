import { contrastRatio, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('el negro tiene luminancia 0', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('el blanco tiene luminancia 1', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('acepta el hex sin almohadilla', () => {
    expect(relativeLuminance('FFFFFF')).toBeCloseTo(1, 5);
  });

  it('acepta minúsculas', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('el verde pesa más que el rojo y el azul', () => {
    expect(relativeLuminance('#00FF00')).toBeGreaterThan(relativeLuminance('#FF0000'));
    expect(relativeLuminance('#FF0000')).toBeGreaterThan(relativeLuminance('#0000FF'));
  });

  it('rechaza un color que no es hex de seis dígitos', () => {
    // Un color malformado que devolviera un número haría pasar la auditoría
    // con un valor sin sentido.
    expect(() => relativeLuminance('#FFF')).toThrow(/hex/i);
    expect(() => relativeLuminance('rojo')).toThrow(/hex/i);
    expect(() => relativeLuminance('#GGGGGG')).toThrow(/hex/i);
  });
});

describe('contrastRatio', () => {
  it('blanco sobre negro da 21', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 2);
  });

  it('un color contra sí mismo da 1', () => {
    expect(contrastRatio('#3366CC', '#3366CC')).toBeCloseTo(1, 5);
  });

  it('es simétrico', () => {
    expect(contrastRatio('#123456', '#FEDCBA')).toBeCloseTo(contrastRatio('#FEDCBA', '#123456'), 5);
  });

  it('reproduce un valor conocido de referencia', () => {
    // #767676 sobre blanco es el gris límite de AA: 4.54
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 1);
  });
});
