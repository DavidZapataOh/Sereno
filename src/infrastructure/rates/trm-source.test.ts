import { aEnteroConEscala, createTrmSource } from './trm-source';

/** La respuesta real de la fuente, comprobada el 2026-08-31. */
const REAL = [
  {
    valor: '3202.79',
    unidad: 'COP',
    vigenciadesde: '2026-08-29T00:00:00.000',
    vigenciahasta: '2026-08-31T00:00:00.000',
  },
];

function doble(cuerpo: unknown) {
  return jest.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({ json: () => Promise.resolve(cuerpo) } as unknown as Response),
  );
}

const leer = (f: ReturnType<typeof doble>) =>
  createTrmSource(f as unknown as typeof fetch).ultima();

describe('aEnteroConEscala', () => {
  /**
   * `parseFloat` aquí introduce un error que después se multiplica por el
   * saldo entero.
   */
  it('convierte el decimal sin pasar por coma flotante', () => {
    expect(aEnteroConEscala('3202.79', 2)).toBe(320_279n);
  });

  it('rellena los decimales que falten', () => {
    expect(aEnteroConEscala('3202.7', 2)).toBe(320_270n);
    expect(aEnteroConEscala('3202', 2)).toBe(320_200n);
  });

  it('recorta los decimales que sobren, sin redondear', () => {
    expect(aEnteroConEscala('3202.799', 2)).toBe(320_279n);
  });

  it('rechaza lo que no es un número', () => {
    expect(() => aEnteroConEscala('tres mil', 2)).toThrow(/número/);
    expect(() => aEnteroConEscala('', 2)).toThrow(/número/);
  });
});

describe('trmSource', () => {
  it('lee la TRM real, con su fecha de vigencia', async () => {
    const tasa = await leer(doble(REAL));

    expect(tasa.valor).toBe(320_279n);
    expect(tasa.escala).toBe(2);
    expect(tasa.desde).toBe('USD');
    expect(tasa.hacia).toBe('COP');
    expect(tasa.momento).toBe('2026-08-29T00:00:00.000-05:00');
  });

  /**
   * Dentro de un mes, «3.202,79» sin más no dice de dónde salió.
   */
  it('anota el origen', async () => {
    expect((await leer(doble(REAL))).origen).toContain('TRM');
  });

  /**
   * Un sábado no hay TRM nueva: rige la del viernes, y la fuente lo dice con
   * el rango de vigencia. Sin esto, el patrimonio se quedaría sin valorar dos
   * días de cada siete.
   */
  it('la vigencia cubre el fin de semana', async () => {
    const tasa = await leer(doble(REAL));

    // Del sábado 29 al lunes 31: la misma tasa.
    expect(tasa.momento.startsWith('2026-08-29')).toBe(true);
  });

  it('una respuesta que no es JSON lanza', async () => {
    const f = jest.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({ json: () => Promise.reject(new SyntaxError('no')) } as unknown as Response),
    );

    await expect(leer(f)).rejects.toThrow(/no es JSON/);
  });

  it('una respuesta con otra forma lanza en vez de devolver un número raro', async () => {
    // Es dinero: un cambio de forma tiene que doler enseguida.
    await expect(leer(doble([{}]))).rejects.toThrow(/cambió de forma/);
    await expect(leer(doble([]))).rejects.toThrow(/cambió de forma/);
  });

  it('rechaza una unidad que no es el peso', async () => {
    await expect(leer(doble([{ ...REAL[0], unidad: 'USD' }]))).rejects.toThrow(/no en pesos/);
  });

  /**
   * Una TRM de 30 pesos o de 300.000 es una respuesta corrupta. Aceptarla
   * multiplicaría o dividiría el patrimonio por cien, y se vería como una
   * noticia buenísima o pésima.
   */
  it('rechaza un valor imposible', async () => {
    await expect(leer(doble([{ ...REAL[0], valor: '30.00' }]))).rejects.toThrow(/imposible/);
    await expect(leer(doble([{ ...REAL[0], valor: '300000.00' }]))).rejects.toThrow(/imposible/);
  });
});
