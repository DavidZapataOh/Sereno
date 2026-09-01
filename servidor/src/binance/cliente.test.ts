import { describe, expect, it, vi } from 'vitest';

import { aEntero, crearClienteBinance } from './cliente';

const CLAVE = 'clave-de-prueba-que-no-debe-aparecer';
const SECRETO = 'secreto-de-prueba-que-no-debe-aparecer';

/**
 * Tipado con `typeof fetch`: así `mock.calls` conserva los argumentos y se
 * puede inspeccionar la petición, que es lo que estas pruebas comprueban.
 */
function doble(cuerpo: unknown, status = 200) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(cuerpo),
    } as unknown as Response),
  );
}

/**
 * Un doble que responde según la ruta. Hace falta porque `saldos()` pide dos
 * billeteras distintas: Spot y Fondos.
 */
function doblePorRuta(spot: unknown, fondos: unknown) {
  return vi.fn<typeof fetch>((entrada) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(comoTexto(entrada).includes('get-funding-asset') ? fondos : spot),
    } as unknown as Response),
  );
}

/**
 * La URL de una llamada, como texto.
 *
 * El primer argumento de `fetch` puede ser `URL` o `Request`, así que
 * convertirlo con `String()` daría «[object Object]» en cuanto alguien pase
 * otra cosa: una prueba que compara contra eso pasa siempre y no comprueba
 * nada. El lint lo prohíbe por ese motivo.
 */
function comoTexto(entrada: unknown): string {
  return typeof entrada === 'string' ? entrada : '';
}

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

  /**
   * El fallo que tumbó el servidor el 2026-08-31. Binance rechazó la clave con
   * un 401 cuyo cuerpo no traía `code`, el cliente lo devolvió como si fuera
   * bueno, y `verificarPermisos` recibió un objeto vacío: el servidor se negó a
   * arrancar diciendo «la clave no puede leer», que era mentira y mandaba a
   * buscar donde no era.
   */
  it('un estado HTTP de error lanza aunque el cuerpo no traiga código', async () => {
    await expect(cliente(doble({}, 401)).permisos()).rejects.toThrow(/401/);
  });

  /**
   * El que de verdad importaba, y que el primer arreglo dejó pasar.
   *
   * Binance responde **451 con `code: 0`** cuando la petición sale de un país
   * restringido —lo que ocurre desde Railway, cuyos servidores están en
   * Estados Unidos—. Cero no es menor que cero, así que el cuerpo pasaba la
   * reja de los códigos negativos; y como sí traía un número, pasaba también
   * la reja del estado tal como la escribí la primera vez. Resultado: se
   * devolvía como si fueran los permisos, y `enableReading` salía indefinido.
   */
  it('un 451 por región restringida no se cuela como respuesta buena', async () => {
    const restringido = {
      code: 0,
      msg: 'Service unavailable from a restricted location according to b. Eligibility',
    };

    await expect(cliente(doble(restringido, 451)).permisos()).rejects.toThrow(/451/);
    await expect(cliente(doble(restringido, 451)).permisos()).rejects.toThrow(/restricted/);
  });

  it('el estado manda aunque el cuerpo traiga un código no negativo', async () => {
    await expect(cliente(doble({ code: 0 }, 403)).permisos()).rejects.toThrow(/403/);
  });

  it('sin mensaje en el cuerpo, el error dice al menos el estado', async () => {
    await expect(cliente(doble({}, 418)).permisos()).rejects.toThrow(/418/);
  });

  it('el error conserva estado, código y mensaje: cada uno dice algo distinto', async () => {
    // -2014 es «formato de clave inválido» y -2015 es «clave, IP o permisos»:
    // perder el código sería perder la diferencia.
    const error = cliente(doble({ code: -2015, msg: 'Invalid API-key' }, 401)).permisos();

    await expect(error).rejects.toThrow(/401/);
    await expect(
      cliente(doble({ code: -2015, msg: 'Invalid API-key' }, 401)).permisos(),
    ).rejects.toThrow(/-2015/);
    await expect(
      cliente(doble({ code: -2015, msg: 'Invalid API-key' }, 401)).permisos(),
    ).rejects.toThrow(/Invalid API-key/);
  });

  it('una respuesta que no es JSON lanza', async () => {
    const f = vi.fn<typeof fetch>(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('no')),
      } as unknown as Response),
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

describe('Spot y Fondos', () => {
  /**
   * El caso real: el dinero de David estaba en Fondos, y mirar solo Spot
   * devolvía cero —que no se distingue de no tener nada—.
   */
  it('encuentra el saldo aunque solo esté en Fondos', async () => {
    const saldos = await cliente(
      doblePorRuta(cuentaCon([]), [{ asset: 'USDC', free: '12.50000000' }]),
    ).saldos();

    expect(saldos).toEqual([{ activo: 'USDC', cantidad: 12_500_000n }]);
  });

  /**
   * Se suman en un solo número. Mover dinero de Fondos a Spot es cambiarlo de
   * bolsillo: con cuentas separadas cada traslado dejaría dos ajustes que se
   * anulan, y eso es ruido en el historial.
   */
  it('suma el mismo activo en las dos billeteras', async () => {
    const saldos = await cliente(
      doblePorRuta(cuentaCon([{ asset: 'USDC', free: '3.00000000' }]), [
        { asset: 'USDC', free: '2.00000000' },
      ]),
    ).saldos();

    expect(saldos).toEqual([{ activo: 'USDC', cantidad: 5_000_000n }]);
  });

  /**
   * Fondos trae dos columnas que Spot no: lo congelado y lo que está saliendo
   * en un retiro. Lo que está en camino todavía es suyo hasta que llega al
   * otro lado; descontarlo lo haría desaparecer a mitad de camino.
   */
  it('cuenta también lo congelado y lo que está saliendo', async () => {
    const saldos = await cliente(
      doblePorRuta(cuentaCon([]), [
        {
          asset: 'USDT',
          free: '1.00000000',
          locked: '2.00000000',
          freeze: '3.00000000',
          withdrawing: '4.00000000',
        },
      ]),
    ).saldos();

    expect(saldos[0]?.cantidad).toBe(10_000_000n);
  });

  it('en Fondos también se ignora lo que no se sigue', async () => {
    const saldos = await cliente(
      doblePorRuta(cuentaCon([]), [
        { asset: 'HMSTR', free: '999.00000000' },
        { asset: 'USDC', free: '1.00000000' },
      ]),
    ).saldos();

    expect(saldos.map((s) => s.activo)).toEqual(['USDC']);
  });

  it('un activo en cero en las dos no aparece', async () => {
    const saldos = await cliente(
      doblePorRuta(cuentaCon([{ asset: 'USDC', free: '0' }]), [{ asset: 'USDC', free: '0' }]),
    ).saldos();

    expect(saldos).toEqual([]);
  });

  it('Fondos se pide con POST: en GET Binance no la sirve', async () => {
    const f = doblePorRuta(cuentaCon([]), []);

    await cliente(f).saldos();

    const llamada = f.mock.calls.find((c) => comoTexto(c[0]).includes('get-funding-asset'));
    expect(llamada?.[1]?.method).toBe('POST');
    // La firma va en la URL también en POST: Binance no la lee del cuerpo.
    expect(comoTexto(llamada?.[0])).toMatch(/&signature=[0-9a-f]{64}$/);
  });

  it('si Fondos falla, no se devuelve solo Spot en silencio', async () => {
    // Media respuesta enseñada como si fuera entera es un saldo que falta sin
    // que nada lo diga.
    const f = vi.fn<typeof fetch>((entrada) =>
      Promise.resolve({
        ok: !comoTexto(entrada).includes('get-funding-asset'),
        status: comoTexto(entrada).includes('get-funding-asset') ? 500 : 200,
        json: () =>
          Promise.resolve(comoTexto(entrada).includes('get-funding-asset') ? {} : cuentaCon([])),
      } as unknown as Response),
    );

    await expect(cliente(f).saldos()).rejects.toThrow(/500/);
  });
});
