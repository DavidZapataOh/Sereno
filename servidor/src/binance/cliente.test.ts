import { describe, expect, it, vi } from 'vitest';

import { aEntero, crearClienteBinance } from './cliente';

const CLAVE = 'clave-de-prueba-que-no-debe-aparecer';
const SECRETO = 'secreto-de-prueba-que-no-debe-aparecer';

/**
 * Tipado con `typeof fetch`: así `mock.calls` conserva los argumentos y se
 * puede inspeccionar la petición, que es lo que estas pruebas comprueban.
 */
function doble(cuerpo: unknown) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve({ json: () => Promise.resolve(cuerpo) } as unknown as Response),
  );
}

/** La URL de la primera petición. El primer argumento de `fetch` puede no ser texto. */
function urlDe(f: ReturnType<typeof doble>): string {
  const url = f.mock.calls[0]?.[0];
  if (typeof url !== 'string') throw new Error('la petición no llevó una URL de texto');
  return url;
}

const cliente = (f: ReturnType<typeof doble>) =>
  crearClienteBinance({ clave: CLAVE, secreto: SECRETO }, f);

const cuentaCon = (balances: { asset: string; free: string; locked?: string }[]) => ({ balances });

describe('aEntero', () => {
  it('convierte el decimal de Binance sin pasar por float', () => {
    expect(aEntero('0.08576100', 6)).toBe(85_761n);
  });

  it('rellena y recorta según la escala', () => {
    expect(aEntero('1.5', 6)).toBe(1_500_000n);
    expect(aEntero('1.1234567', 6)).toBe(1_123_456n);
  });

  it('rechaza lo que no es un número', () => {
    expect(() => aEntero('mucho', 6)).toThrow(/no es número/);
  });
});

describe('clienteBinance', () => {
  it('manda la clave en la cabecera, no en la URL', () => {
    const f = doble(cuentaCon([]));

    void cliente(f).saldos();

    const init = f.mock.calls[0]?.[1];
    expect((init?.headers as Record<string, string>)['X-MBX-APIKEY']).toBe(CLAVE);
  });

  it('la URL lleva la firma al final', async () => {
    const f = doble(cuentaCon([]));

    await cliente(f).saldos();

    expect(urlDe(f)).toMatch(/&signature=[0-9a-f]{64}$/);
  });

  it('devuelve solo los activos seguidos que no son cero', async () => {
    // Binance devuelve cientos de monedas, casi todas en cero.
    const saldos = await cliente(
      doble(
        cuentaCon([
          { asset: 'USDC', free: '10.00000000' },
          { asset: 'USDT', free: '0.00000000' },
          { asset: 'BTC', free: '0.50000000' },
          { asset: 'PEPE', free: '999999.00000000' },
        ]),
      ),
    ).saldos();

    expect(saldos.map((s) => s.activo)).toEqual(['USDC']);
  });

  it('suma lo libre y lo bloqueado: lo de una orden sigue siendo suyo', async () => {
    const saldos = await cliente(
      doble(cuentaCon([{ asset: 'USDC', free: '10.00000000', locked: '5.00000000' }])),
    ).saldos();

    expect(saldos[0]?.cantidad).toBe(15_000_000n);
  });

  it('respeta la escala al convertir el decimal', async () => {
    const saldos = await cliente(
      doble(cuentaCon([{ asset: 'USDC', free: '0.08576100' }])),
    ).saldos();

    expect(saldos[0]?.cantidad).toBe(85_761n);
  });

  it('un error de Binance sube con su código y su mensaje', async () => {
    await expect(cliente(doble({ code: -2015, msg: 'Invalid API-key' })).saldos()).rejects.toThrow(
      /-2015/,
    );
  });

  it('una respuesta que no es JSON lanza', async () => {
    const f = vi.fn<typeof fetch>(() =>
      Promise.resolve({ json: () => Promise.reject(new SyntaxError('no')) } as unknown as Response),
    );

    await expect(
      crearClienteBinance({ clave: CLAVE, secreto: SECRETO }, f).saldos(),
    ).rejects.toThrow(/no es JSON/);
  });

  /**
   * Los registros acaban en sitios que no controlamos. Ni la clave, ni el
   * secreto, ni la firma pueden aparecer nunca en un mensaje de error.
   */
  it('ningún error lleva la clave, el secreto ni la firma', async () => {
    const error = await cliente(doble({ code: -1022, msg: 'Signature not valid' }))
      .saldos()
      .catch((e: unknown) => String(e));

    expect(error).not.toContain(CLAVE);
    expect(error).not.toContain(SECRETO);
    expect(error).not.toMatch(/signature=/);
  });

  it('los permisos se piden a la ruta de restricciones', async () => {
    const f = doble({ enableReading: true });

    await cliente(f).permisos();

    expect(urlDe(f)).toContain('/sapi/v1/account/apiRestrictions');
  });

  it('sin balances no falla', async () => {
    expect(await cliente(doble({})).saldos()).toEqual([]);
  });
});
