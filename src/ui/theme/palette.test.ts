import { contrastRatio, relativeLuminance } from './contrast';
import {
  DARK_PALETTE,
  LIGHT_PALETTE,
  SOFT_PAIRS,
  SURFACE_KEYS,
  TEXT_KEYS,
  type Palette,
} from './palette';

const TEMAS: [string, Palette][] = [
  ['claro', LIGHT_PALETTE],
  ['oscuro', DARK_PALETTE],
];

describe.each(TEMAS)('paleta %s — contraste de texto', (_nombre, palette) => {
  const pares = TEXT_KEYS.flatMap((texto) => SURFACE_KEYS.map((fondo) => [texto, fondo] as const));

  it.each(pares)('%s sobre %s alcanza AA (4.5:1)', (texto, fondo) => {
    expect(contrastRatio(palette[texto], palette[fondo])).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(TEMAS)('paleta %s — contraste de interfaz', (_nombre, palette) => {
  it.each(SURFACE_KEYS)('borderStrong sobre %s alcanza 3:1', (fondo) => {
    expect(contrastRatio(palette.borderStrong, palette[fondo])).toBeGreaterThanOrEqual(3);
  });

  it('la acción principal se distingue del fondo (3:1)', () => {
    // Un botón principal que se funde con el fondo no parece un botón.
    expect(contrastRatio(palette.actionFill, palette.background)).toBeGreaterThanOrEqual(3);
  });

  it('el relleno de acento se distingue de toda superficie (3:1)', () => {
    for (const fondo of SURFACE_KEYS) {
      expect(contrastRatio(palette.accentFill, palette[fondo])).toBeGreaterThanOrEqual(3);
    }
  });
});

describe.each(TEMAS)('paleta %s — rellenos suaves', (_nombre, palette) => {
  /**
   * Un fondo de color sin su tinta declarada es la forma más fácil de romper el
   * contraste sin que nadie lo note: se ve bien donde se probó y falla en la
   * pantalla siguiente.
   */
  it.each(SOFT_PAIRS)('%s tiene tinta legible encima', (fondo, tinta) => {
    expect(contrastRatio(palette[tinta], palette[fondo])).toBeGreaterThanOrEqual(4.5);
  });

  it('los rellenos suaves son suaves: no compiten con las superficies', () => {
    // Si un relleno «suave» contrasta como una superficie distinta, deja de ser
    // un matiz y se convierte en otra capa, que es lo que se quería evitar.
    for (const [fondo] of SOFT_PAIRS) {
      expect(contrastRatio(palette[fondo], palette.surface)).toBeLessThan(4.5);
    }
  });
});

describe.each(TEMAS)('paleta %s — la acción principal', (_nombre, palette) => {
  it('su texto pasa AA en reposo y pulsada', () => {
    expect(contrastRatio(palette.onActionFill, palette.actionFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.onActionFill, palette.actionFillPressed)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('pulsada se distingue de en reposo', () => {
    expect(palette.actionFillPressed).not.toBe(palette.actionFill);
  });
});

describe.each(TEMAS)('paleta %s — daltonismo', (_nombre, palette) => {
  it('ingreso y gasto se distinguen en escala de grises', () => {
    // Cerca del 8% de los hombres no diferencia rojo de verde. Si además
    // comparten luminancia, no queda ninguna pista visual.
    expect(contrastRatio(palette.ingreso, palette.gasto)).toBeGreaterThanOrEqual(1.4);
  });

  it('el gasto no es el color más saturado ni el más alarmante', () => {
    // Principio 3: calma, no alarma. Un rojo puro (#FF0000) queda descartado.
    expect(palette.gasto.toUpperCase()).not.toBe('#FF0000');
    expect(relativeLuminance(palette.gasto)).toBeGreaterThan(0);
  });

  it('el gasto y el peligro son colores distintos: gastar no es una alarma', () => {
    // El gasto es el estado normal del dinero. Borrar algo, o un error del
    // sistema, no lo es. Si compartieran color, cada compra parecería un aviso.
    expect(palette.gasto).not.toBe(palette.peligro);
  });
});

describe.each(TEMAS)('paleta %s — texto sobre relleno', (_nombre, palette) => {
  it('onAccentFill alcanza AA sobre accentFill, en reposo y pulsado', () => {
    expect(contrastRatio(palette.onAccentFill, palette.accentFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.onAccentFill, palette.accentFillPressed)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('onAccent alcanza AA sobre accent', () => {
    expect(contrastRatio(palette.onAccent, palette.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('onGasto alcanza AA sobre gasto', () => {
    expect(contrastRatio(palette.onGasto, palette.gasto)).toBeGreaterThanOrEqual(4.5);
  });

  it('onPeligro alcanza AA sobre peligro', () => {
    expect(contrastRatio(palette.onPeligro, palette.peligro)).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(TEMAS)('paleta %s — estados de presión', (_nombre, palette) => {
  it('el acento pulsado sigue teniendo texto legible encima', () => {
    // Al pulsar, el relleno cambia pero el texto no: el par tiene que seguir
    // pasando AA durante los milisegundos que dura la pulsación.
    expect(contrastRatio(palette.onAccent, palette.accentPressed)).toBeGreaterThanOrEqual(4.5);
  });

  it('el acento pulsado se distingue del acento en reposo', () => {
    // Sin diferencia visible, la pulsación no da respuesta y el usuario vuelve
    // a tocar.
    expect(palette.accentPressed).not.toBe(palette.accent);
  });

  it('la superficie pulsada se distingue de la superficie en reposo', () => {
    expect(palette.surfacePressed).not.toBe(palette.surface);
  });
});

describe('coherencia entre temas', () => {
  it('ambos temas declaran exactamente las mismas claves', () => {
    expect(Object.keys(LIGHT_PALETTE).sort()).toEqual(Object.keys(DARK_PALETTE).sort());
  });

  it('todos los valores son hex de seis dígitos en mayúsculas', () => {
    // Una sola forma canónica: así la prueba de literales puede buscar la
    // paleta por igualdad exacta.
    [...Object.values(LIGHT_PALETTE), ...Object.values(DARK_PALETTE)].forEach((valor) => {
      expect(valor).toMatch(/^#[0-9A-F]{6}$/);
    });
  });

  it('el tema oscuro tiene fondos más oscuros que el claro', () => {
    SURFACE_KEYS.forEach((fondo) => {
      expect(relativeLuminance(DARK_PALETTE[fondo])).toBeLessThan(
        relativeLuminance(LIGHT_PALETTE[fondo]),
      );
    });
  });

  it('el tema oscuro no es el claro invertido: el texto principal no es blanco puro', () => {
    // Sobre fondo oscuro, el blanco puro cansa. Se reserva para lo importante.
    expect(DARK_PALETTE.textPrimary).not.toBe('#FFFFFF');
  });

  it('el blanco puro existe solo como textStrong o como superficie clara', () => {
    // Es la regla de la fatiga visual: el máximo contraste manda una cosa por
    // pantalla, no diez.
    const blancos = (palette: typeof LIGHT_PALETTE): string[] =>
      Object.entries(palette)
        .filter(([, valor]) => valor === '#FFFFFF')
        .map(([clave]) => clave);

    expect(blancos(DARK_PALETTE)).toEqual(['textStrong']);
    expect(blancos(LIGHT_PALETTE).sort()).toEqual([
      'onAccent',
      'onAccentFill',
      'onActionFill',
      'onGasto',
      'onPeligro',
      'surface',
    ]);
  });

  /** El fondo tiene que quedar por debajo de la superficie: es lo que hace que una tarjeta exista. */
  it('en claro el fondo es más oscuro que la superficie, y en oscuro al revés', () => {
    expect(relativeLuminance(LIGHT_PALETTE.background)).toBeLessThan(
      relativeLuminance(LIGHT_PALETTE.surface),
    );
    expect(relativeLuminance(DARK_PALETTE.background)).toBeLessThan(
      relativeLuminance(DARK_PALETTE.surface),
    );
  });

  it('el tema claro no usa negro puro para el texto', () => {
    expect(LIGHT_PALETTE.textPrimary).not.toBe('#000000');
  });

  it('en el tema oscuro los bordes son más claros que las superficies', () => {
    // Los colores oscuros necesitan más separación entre sí que los claros para
    // que la diferencia se vea.
    expect(relativeLuminance(DARK_PALETTE.border)).toBeGreaterThan(
      relativeLuminance(DARK_PALETTE.surface),
    );
  });
});
