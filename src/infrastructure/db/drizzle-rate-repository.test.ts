import { rate, type Rate } from '@/domain/rates/rate';

import { createDrizzleRateRepository } from './drizzle-rate-repository';
import { createTestDb } from './test-client';

const TRM = (valor: bigint, momento: string): Rate =>
  rate({ desde: 'USD', hacia: 'COP', valor, escala: 2, origen: 'TRM oficial', momento });

describe('RateRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleRateRepository>;

  beforeEach(() => {
    cliente = createTestDb();
    repo = createDrizzleRateRepository(cliente.db);
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda una tasa con su origen y su momento', async () => {
    const tasa = TRM(320_279n, '2026-08-29T00:00:00.000-05:00');

    await repo.guardar(tasa);

    expect(await repo.ultima('USD', 'COP')).toEqual(tasa);
  });

  /**
   * El valor va y vuelve como texto, nunca como `number`: un float aquí
   * introduce un error que después se multiplica por el saldo entero.
   */
  it('el valor vuelve entero, sin pasar por float', async () => {
    await repo.guardar(TRM(9_007_199_254_740_993n, '2026-08-29T00:00:00.000-05:00'));

    expect((await repo.ultima('USD', 'COP'))?.valor).toBe(9_007_199_254_740_993n);
  });

  /**
   * Se pueden guardar fuera de orden: al recuperar un histórico, por ejemplo.
   */
  it('la última es la más reciente, no la última insertada', async () => {
    await repo.guardar(TRM(320_279n, '2026-08-29T00:00:00.000-05:00'));
    await repo.guardar(TRM(314_428n, '2026-08-28T00:00:00.000-05:00'));

    expect((await repo.ultima('USD', 'COP'))?.valor).toBe(320_279n);
  });

  it('la misma tasa dos veces no se duplica', async () => {
    const tasa = TRM(320_279n, '2026-08-29T00:00:00.000-05:00');

    await repo.guardar(tasa);
    await repo.guardar(tasa);

    expect(await repo.vigentes()).toHaveLength(1);
  });

  /**
   * Valorar el patrimonio de hace un mes con la tasa de hoy lo reescribiría, y
   * la gráfica cambiaría sola cada día.
   */
  it('la de una fecha pasada es la que regía ese día, no la de hoy', async () => {
    await repo.guardar(TRM(314_428n, '2026-08-28T00:00:00.000-05:00'));
    await repo.guardar(TRM(320_279n, '2026-08-29T00:00:00.000-05:00'));

    expect((await repo.enFecha('USD', 'COP', '2026-08-28'))?.valor).toBe(314_428n);
  });

  it('la de un día sin publicación es la última vigente', async () => {
    // La TRM del viernes rige el sábado y el domingo.
    await repo.guardar(TRM(320_279n, '2026-08-29T00:00:00.000-05:00'));

    expect((await repo.enFecha('USD', 'COP', '2026-08-30'))?.valor).toBe(320_279n);
  });

  it('la de una fecha anterior a todo lo guardado es null', async () => {
    await repo.guardar(TRM(320_279n, '2026-08-29T00:00:00.000-05:00'));

    expect(await repo.enFecha('USD', 'COP', '2026-01-01')).toBeNull();
  });

  it('sin nada guardado, no hay última', async () => {
    expect(await repo.ultima('USD', 'COP')).toBeNull();
    expect(await repo.vigentes()).toEqual([]);
  });

  it('las vigentes traen una por par, la más reciente', async () => {
    await repo.guardar(TRM(314_428n, '2026-08-28T00:00:00.000-05:00'));
    await repo.guardar(TRM(320_279n, '2026-08-29T00:00:00.000-05:00'));
    await repo.guardar(
      rate({
        desde: 'USDC',
        hacia: 'USD',
        valor: 100_018_000n,
        escala: 8,
        origen: 'Binance',
        momento: '2026-08-31T10:00:00.000-05:00',
      }),
    );

    const vigentes = await repo.vigentes();

    expect(vigentes).toHaveLength(2);
    expect(vigentes.find((t) => t.desde === 'USD')?.valor).toBe(320_279n);
  });

  it('no mezcla pares distintos', async () => {
    await repo.guardar(TRM(320_279n, '2026-08-29T00:00:00.000-05:00'));

    expect(await repo.ultima('USDC', 'USD')).toBeNull();
  });
});
