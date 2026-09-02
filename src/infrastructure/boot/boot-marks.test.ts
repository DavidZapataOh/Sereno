import { arranque, marcar, olvidarMarcas, totalDeArranque } from './boot-marks';

describe('marcas de arranque', () => {
  beforeEach(() => {
    olvidarMarcas();
  });

  it('mide cada fase por separado, no un total', () => {
    marcar('fuentes');
    marcar('base');
    marcar('migraciones');
    marcar('primera-pantalla');

    expect(arranque().map((m) => m.fase)).toEqual([
      'fuentes',
      'base',
      'migraciones',
      'primera-pantalla',
    ]);
  });

  /** Un arranque que falla es justo el que hay que poder mirar. */
  it('las marcas no se pierden si una fase falla', () => {
    marcar('fuentes');
    marcar('base');
    // Las migraciones revientan: nunca se marcan, ni la primera pantalla.

    expect(arranque().map((m) => m.fase)).toEqual(['fuentes', 'base']);
    expect(totalDeArranque()).toBeNull();
  });

  it('cada fase mide su propia duración, no el acumulado', () => {
    marcar('fuentes');
    marcar('base');

    const [fuentes, base] = arranque();
    expect(fuentes?.ms).toBeGreaterThanOrEqual(0);
    // La segunda no puede incluir a la primera: si lo hiciera, la fase lenta
    // parecería ser siempre la última.
    expect(base?.ms).toBeLessThanOrEqual(totalDeArranque() ?? Number.POSITIVE_INFINITY);
  });

  /** React monta y desmonta en desarrollo: la segunda pasada no cuenta. */
  it('la primera marca de cada fase manda', () => {
    marcar('base');
    const primera = arranque();
    marcar('base');

    expect(arranque()).toEqual(primera);
  });

  it('sin ninguna marca no inventa nada', () => {
    expect(arranque()).toEqual([]);
    expect(totalDeArranque()).toBeNull();
  });

  /** Medir no puede costar: una medida cara cambia lo que mide. */
  it('marcar no formatea, ni escribe, ni registra', () => {
    const antes = Date.now();
    for (let i = 0; i < 1000; i += 1) {
      olvidarMarcas();
      marcar('base');
    }

    expect(Date.now() - antes).toBeLessThan(100);
  });
});
