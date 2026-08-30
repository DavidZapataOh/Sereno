import { FONT_FAMILY, TYPE_SCALE, type TypeLevel, type TypeScaleKey } from './typography';

const CLAVES = Object.keys(TYPE_SCALE) as TypeScaleKey[];

describe('escala tipográfica', () => {
  it('define los niveles esperados', () => {
    expect([...CLAVES].sort()).toEqual(
      [
        'montoGrande',
        'montoMediano',
        'montoPequeno',
        'titulo',
        'subtitulo',
        'cuerpo',
        'apoyo',
        'micro',
      ].sort(),
    );
  });

  it.each(CLAVES)('%s declara tamaño, interlineado y familia', (clave) => {
    const nivel = TYPE_SCALE[clave];
    expect(nivel.fontSize).toBeGreaterThan(0);
    expect(nivel.lineHeight).toBeGreaterThan(0);
    expect(nivel.fontFamily.length).toBeGreaterThan(0);
  });

  it.each(CLAVES)('%s tiene interlineado mayor que el tamaño', (clave) => {
    const nivel = TYPE_SCALE[clave];
    expect(nivel.lineHeight).toBeGreaterThan(nivel.fontSize);
  });

  it.each(CLAVES)('%s usa una familia declarada, no un nombre suelto', (clave) => {
    // Un nombre de familia mal escrito no falla: Android cae a la fuente del
    // sistema en silencio y la app se ve distinta sin que nadie sepa por qué.
    expect(Object.values<string>(FONT_FAMILY)).toContain(TYPE_SCALE[clave].fontFamily);
  });

  it('ningún nivel baja de 12: por debajo no se lee en un teléfono', () => {
    CLAVES.forEach((clave) => {
      expect(TYPE_SCALE[clave].fontSize).toBeGreaterThanOrEqual(12);
    });
  });

  it('los montos son más grandes que el cuerpo: la cifra manda', () => {
    expect(TYPE_SCALE.montoGrande.fontSize).toBeGreaterThan(TYPE_SCALE.cuerpo.fontSize);
    expect(TYPE_SCALE.montoMediano.fontSize).toBeGreaterThanOrEqual(TYPE_SCALE.cuerpo.fontSize);
  });

  it('la escala es estrictamente decreciente en el orden declarado', () => {
    const orden: TypeScaleKey[] = [
      'montoGrande',
      'titulo',
      'montoMediano',
      'subtitulo',
      'cuerpo',
      'montoPequeno',
      'apoyo',
      'micro',
    ];
    const tamanos = orden.map((clave) => TYPE_SCALE[clave].fontSize);
    const ordenados = [...tamanos].sort((a, b) => b - a);
    expect(tamanos).toEqual(ordenados);
    expect(new Set(tamanos).size).toBe(tamanos.length);
  });

  it('el espaciado negativo solo aparece en los tamaños grandes', () => {
    // A tamaño pequeño, juntar las letras las vuelve ilegibles.
    CLAVES.forEach((clave) => {
      const nivel: TypeLevel = TYPE_SCALE[clave];
      if (nivel.letterSpacing !== undefined && nivel.letterSpacing < 0) {
        expect(nivel.fontSize).toBeGreaterThanOrEqual(20);
      }
    });
  });
});
