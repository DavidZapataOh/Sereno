import { rate, type Rate } from '@/domain/rates/rate';
import type { RateRepository } from '@/domain/rates/rate-repository';

import { refreshRates, type FuenteDeTasas, type RefreshRatesDeps } from './refresh-rates';

const AHORA = '2026-08-31T10:00:00.000-05:00';
const HACE_UN_MINUTO = '2026-08-31T09:59:00.000-05:00';
const AYER = '2026-08-30T10:00:00.000-05:00';

const trm = (momento: string): Rate =>
  rate({ desde: 'USD', hacia: 'COP', valor: 320_279n, escala: 2, origen: 'TRM oficial', momento });

/** Repositorio en memoria: el de verdad ya tiene sus propias pruebas. */
function repoDoble(iniciales: Rate[] = []): RateRepository {
  const guardadas = [...iniciales];
  return {
    guardar: (t) => {
      guardadas.push(t);
      return Promise.resolve();
    },
    ultima: (desde, hacia) =>
      Promise.resolve(
        guardadas
          .filter((t) => t.desde === desde && t.hacia === hacia)
          .sort((a, b) => b.momento.localeCompare(a.momento))[0] ?? null,
      ),
    enFecha: () => Promise.resolve(null),
    vigentes: () => Promise.resolve(guardadas),
  };
}

const fuenteTrm = (leer: () => Promise<Rate>): FuenteDeTasas => ({
  par: { desde: 'USD', hacia: 'COP' },
  leer,
});

const deps = (rates: RateRepository, fuentesDeTasas: FuenteDeTasas[]): RefreshRatesDeps => ({
  rates,
  fuentesDeTasas,
  clock: () => AHORA,
});

describe('refreshRates', () => {
  it('guarda las tasas nuevas', async () => {
    const repo = repoDoble();

    const resumen = await refreshRates(deps(repo, [fuenteTrm(() => Promise.resolve(trm(AHORA)))]));

    expect(resumen).toMatchObject({ pedidas: 1, guardadas: 1, fallidos: [] });
    expect(await repo.ultima('USD', 'COP')).not.toBeNull();
  });

  /**
   * La TRM cambia una vez al día. Pedirla en cada arranque es maltratar una
   * API pública y gratuita para no enterarse de nada.
   */
  it('no la pide si la última es de hace un minuto', async () => {
    const leer = jest.fn(() => Promise.resolve(trm(AHORA)));

    const resumen = await refreshRates(deps(repoDoble([trm(HACE_UN_MINUTO)]), [fuenteTrm(leer)]));

    expect(resumen.pedidas).toBe(0);
    expect(leer).not.toHaveBeenCalled();
  });

  it('sí la pide si la última es de ayer', async () => {
    const resumen = await refreshRates(
      deps(repoDoble([trm(AYER)]), [fuenteTrm(() => Promise.resolve(trm(AHORA)))]),
    );

    expect(resumen.pedidas).toBe(1);
  });

  it('con forzar, la pide aunque esté fresca', async () => {
    const resumen = await refreshRates(
      deps(repoDoble([trm(HACE_UN_MINUTO)]), [fuenteTrm(() => Promise.resolve(trm(AHORA)))]),
      { forzar: true },
    );

    expect(resumen.pedidas).toBe(1);
  });

  /**
   * Valorar con la tasa de ayer, diciendo que es de ayer, es mucho mejor que
   * no valorar.
   */
  it('un fallo no borra la última conocida', async () => {
    const repo = repoDoble([trm(AYER)]);

    const resumen = await refreshRates(
      deps(repo, [fuenteTrm(() => Promise.reject(new Error('sin red')))]),
    );

    expect(resumen.fallidos).toEqual(['USD->COP']);
    expect((await repo.ultima('USD', 'COP'))?.momento).toBe(AYER);
  });

  it('si una fuente falla, guarda las que sí', async () => {
    const precio: FuenteDeTasas = {
      par: { desde: 'USDC', hacia: 'USD' },
      leer: () =>
        Promise.resolve(
          rate({
            desde: 'USDC',
            hacia: 'USD',
            valor: 100_018_000n,
            escala: 8,
            origen: 'Binance',
            momento: AHORA,
          }),
        ),
    };

    const resumen = await refreshRates(
      deps(repoDoble(), [fuenteTrm(() => Promise.reject(new Error('sin red'))), precio]),
    );

    expect(resumen.guardadas).toBe(1);
    expect(resumen.fallidos).toEqual(['USD->COP']);
  });

  it('sin fuentesDeTasas no hace nada y no falla', async () => {
    expect(await refreshRates(deps(repoDoble(), []))).toEqual({
      pedidas: 0,
      guardadas: 0,
      fallidos: [],
    });
  });
});
