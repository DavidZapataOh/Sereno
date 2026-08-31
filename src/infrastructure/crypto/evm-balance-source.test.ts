import { CADENAS_EVM, type Wallet } from '@/domain/crypto/wallet';
import { ownerId } from '@/domain/ledger/ids';

import { createEvmBalanceSource, datosDeBalanceOf, NODOS } from './evm-balance-source';

const owner = ownerId('david');
const AHORA = '2026-08-31T10:00:00.000-05:00';

const walletPolygon: Wallet = {
  id: 'w-polygon',
  owner,
  red: 'evm',
  direccion: '0x5a4e9Bb1f224e8254C1d63e90dE34E8572f8dC71',
  nombre: 'Polygon',
};

/** Un `fetch` que responde siempre lo mismo. */
function doble(cuerpo: unknown) {
  // Tipado con los argumentos de `fetch`: sin ellos, `mock.calls` es una
  // tupla vacía y no se puede inspeccionar la petición, que es justo lo que
  // estas pruebas comprueban.
  return jest.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({ json: () => Promise.resolve(cuerpo) } as unknown as Response),
  );
}

/** Lo que devuelve un nodo caído o limitando: HTML, no JSON. */
function dobleHtml() {
  return jest.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({
      json: () => Promise.reject(new SyntaxError('Unexpected token <')),
    } as unknown as Response),
  );
}

/** El cuerpo JSON de la primera petición. `body` es `BodyInit`, no `string`. */
function cuerpoDe(f: ReturnType<typeof doble>): string {
  const body = f.mock.calls[0]?.[1]?.body;
  if (typeof body !== 'string') throw new Error('la petición no llevó cuerpo de texto');
  return body;
}

const leer = (f: ReturnType<typeof doble>) =>
  createEvmBalanceSource('polygon', f as unknown as typeof fetch, () => AHORA).leerSaldos(
    walletPolygon,
  );

describe('datosDeBalanceOf', () => {
  /**
   * Si el relleno se hace mal, el nodo responde cero **sin quejarse**. Es el
   * error más silencioso del adaptador, así que se compara carácter a
   * carácter.
   */
  it('es el selector más la dirección rellenada a 32 bytes', () => {
    expect(datosDeBalanceOf(walletPolygon.direccion)).toBe(
      '0x70a082310000000000000000000000005a4e9bb1f224e8254c1d63e90de34e8572f8dc71',
    );
  });

  it('el resultado siempre mide lo mismo', () => {
    // 2 del «0x» + 8 del selector + 64 de la dirección.
    expect(datosDeBalanceOf(walletPolygon.direccion)).toHaveLength(74);
  });
});

describe('evmBalanceSource', () => {
  it('pide eth_call al contrato del token', async () => {
    const f = doble({ result: '0x0' });

    await leer(f);

    const cuerpo = JSON.parse(cuerpoDe(f)) as {
      method: string;
      params: [{ to: string; data: string }, string];
    };
    expect(cuerpo.method).toBe('eth_call');
    expect(cuerpo.params[0].data).toBe(datosDeBalanceOf(walletPolygon.direccion));
  });

  it('convierte la respuesta hexadecimal a la escala de la moneda', async () => {
    // 0xc350 = 50.000 = 0,05 USDC.e: el saldo real de Polygon el 2026-08-31.
    const saldos = await leer(doble({ result: '0xc350' }));

    expect(saldos.find((s) => s.token.simbolo === 'USDC.e')?.cantidad.amount).toBe(50_000n);
  });

  it('devuelve todos los tokens de la cadena, incluidos los que dan cero', async () => {
    // Un cero es información: «miré y no hay». Distinguirlo de «no miré» es lo
    // que permite avisar cuando una lectura falla.
    const saldos = await leer(doble({ result: '0x0' }));

    expect(saldos).toHaveLength(3);
    expect(saldos.every((s) => s.cantidad.amount === 0n)).toBe(true);
  });

  it('una respuesta «0x» a secas es cero, no un error', async () => {
    const saldos = await leer(doble({ result: '0x' }));

    expect(saldos[0]?.cantidad.amount).toBe(0n);
  });

  /**
   * Los nodos públicos devuelven HTML cuando están caídos o limitando. Se vio
   * al medir el 2026-08-31: `llamarpc` respondió `<!DOCTYPE`. Tomarlo como
   * saldo cero borraría plata de la pantalla.
   */
  it('una respuesta que no es JSON lanza, no se toma como cero', async () => {
    await expect(leer(dobleHtml())).rejects.toThrow(/no es JSON/);
  });

  it('un error del nodo sube con su mensaje', async () => {
    await expect(leer(doble({ error: { message: 'rate limited' } }))).rejects.toThrow(
      /rate limited/,
    );
  });

  it('una respuesta sin resultado lanza', async () => {
    await expect(leer(doble({}))).rejects.toThrow(/no devolvió resultado/);
  });

  it('anota cuándo se leyó cada saldo', async () => {
    const saldos = await leer(doble({ result: '0xc350' }));

    expect(saldos.every((s) => s.leidoEn === AHORA)).toBe(true);
  });
});

describe('NODOS', () => {
  /**
   * Una cadena declarada sin nodo se salta en silencio y su saldo se queda en
   * cero para siempre —y un cero no se distingue de no tener nada—.
   */
  it('hay un nodo por cada cadena EVM declarada', () => {
    expect(Object.keys(NODOS).sort()).toEqual([...CADENAS_EVM].sort());
  });

  it('todos son HTTPS: un nodo en claro deja ver qué direcciones se consultan', () => {
    for (const url of Object.values(NODOS)) expect(url).toMatch(/^https:\/\//);
  });
});
