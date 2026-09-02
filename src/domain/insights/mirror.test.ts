import type { Metrica } from '@/domain/metrics/behavior';

import { CLAVES_CON_FRASE, espejoDe } from './mirror';

const metrica = (clave: string, valor: number, meses = 3): Metrica => ({
  clave,
  valor,
  unidad: 'dias',
  meses,
  queLaMueve: 'lo que sea',
});

describe('espejoDe', () => {
  /** Sin historia suficiente es preferible callar que sonar a verdad. */
  it('sin meses suficientes no dice nada', () => {
    expect(espejoDe([metrica('tasa-de-ahorro', 20, 1)])).toBeNull();
  });

  it('sin métricas no inventa una frase', () => {
    expect(espejoDe([])).toBeNull();
  });

  it('la frase sale del dato, y dice de cuál', () => {
    const espejo = espejoDe([metrica('meses-de-colchon', 4)]);

    expect(espejo?.clave).toBe('meses-de-colchon');
    expect(espejo?.frase).toMatch(/4 meses/);
  });

  /** Una frase que sale todos los días deja de leerse a la semana. */
  it('no repite la de la última vez', () => {
    const metricas = [metrica('meses-de-colchon', 4), metrica('tasa-de-ahorro', 20)];

    expect(espejoDe(metricas, 'meses-de-colchon')?.clave).toBe('tasa-de-ahorro');
  });

  /**
   * La regla que separa el espejo de la charlatanería: describe, no evalúa.
   * «Gastas más los viernes» sí; «gastas demasiado los viernes» no.
   */
  it('ninguna frase juzga', () => {
    const valores = [-10, 0, 0.5, 1, 4, 30, 120];

    for (const clave of CLAVES_CON_FRASE) {
      for (const valor of valores) {
        const espejo = espejoDe([metrica(clave, valor)]);
        if (espejo === null) continue;
        expect(espejo.frase).not.toMatch(
          /demasiado|mucho|poco|mal|bien hecho|deberías|cuidado|ojo|felicidades/i,
        );
      }
    }
  });

  it('ninguna frase deja un número sin redondear', () => {
    const espejo = espejoDe([metrica('antiguedad-del-dinero', 33.3333)]);

    expect(espejo?.frase).not.toMatch(/\.\d{3}/);
  });

  it('una métrica sin frase se salta en vez de romper', () => {
    expect(espejoDe([metrica('metrica-que-no-existe', 5)])).toBeNull();
  });
});
