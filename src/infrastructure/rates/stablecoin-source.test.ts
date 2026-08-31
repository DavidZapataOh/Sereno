import { createStablecoinSource } from './stablecoin-source';

const AHORA = '2026-08-31T10:00:00.000-05:00';

/** La respuesta real de Binance, comprobada el 2026-08-31. */
const REAL = { symbol: 'USDCUSDT', price: '1.00018000' };

function doble(cuerpo: unknown) {
  return jest.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({ json: () => Promise.resolve(cuerpo) } as unknown as Response),
  );
}

function dobleQueFalla() {
  return jest.fn((_url: string, _init?: RequestInit) =>
    Promise.reject(new Error('sin red')),
  ) as unknown as typeof fetch;
}

const precio = (f: typeof fetch) => createStablecoinSource(f, () => AHORA).precio('USDC');

describe('stablecoinSource', () => {
  it('lee el precio real de USDC en dólares', async () => {
    const tasa = await precio(doble(REAL) as unknown as typeof fetch);

    // 1,00018 con ocho decimales.
    expect(tasa.valor).toBe(100_018_000n);
    expect(tasa.escala).toBe(8);
    expect(tasa.origen).toBe('Binance');
  });

  /**
   * Un USDC no vale exactamente un dólar. Con los saldos actuales da igual;
   * con mil dólares no, y volver aquí entonces costaría más.
   */
  it('el precio leído no es uno exacto', async () => {
    const tasa = await precio(doble(REAL) as unknown as typeof fetch);

    expect(tasa.valor).not.toBe(100_000_000n);
  });

  /**
   * La suposición, declarada. La interfaz lo enseña como aproximado, así que
   * nunca queda una suposición sin decir.
   */
  it('sin fuente disponible usa 1:1 y lo marca como aproximado', async () => {
    const tasa = await precio(dobleQueFalla());

    expect(tasa.valor).toBe(100_000_000n);
    expect(tasa.origen).toContain('aproximado');
  });

  it('una respuesta sin precio también cae en el respaldo', async () => {
    const tasa = await precio(doble({ symbol: 'USDCUSDT' }) as unknown as typeof fetch);

    expect(tasa.origen).toContain('aproximado');
  });

  /**
   * Una stablecoin a tres dólares no es una oportunidad: es un dato corrupto,
   * y aceptarlo multiplicaría el patrimonio por tres.
   */
  it('un precio absurdo se rechaza, no se aproxima', async () => {
    await expect(
      precio(doble({ ...REAL, price: '3.00000000' }) as unknown as typeof fetch),
    ).rejects.toThrow(/respuesta rota/);

    await expect(
      precio(doble({ ...REAL, price: '0.10000000' }) as unknown as typeof fetch),
    ).rejects.toThrow(/respuesta rota/);
  });

  it('un susto de mercado dentro del 10 % sí se acepta', async () => {
    // Una stablecoin puede desanclarse de verdad; eso hay que verlo, no
    // descartarlo.
    const tasa = await precio(doble({ ...REAL, price: '0.95000000' }) as unknown as typeof fetch);

    expect(tasa.valor).toBe(95_000_000n);
  });

  it('USDT es la referencia: no se pregunta su precio contra sí mismo', async () => {
    const f = doble(REAL);
    const tasa = await createStablecoinSource(f as unknown as typeof fetch, () => AHORA).precio(
      'USDT',
    );

    expect(f).not.toHaveBeenCalled();
    expect(tasa.origen).toContain('aproximado');
  });
});
