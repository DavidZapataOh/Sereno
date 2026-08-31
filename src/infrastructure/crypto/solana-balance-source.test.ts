import type { Wallet } from '@/domain/crypto/wallet';
import { ownerId } from '@/domain/ledger/ids';

import { createSolanaBalanceSource, mintsNoSeguidos } from './solana-balance-source';

const owner = ownerId('david');
const AHORA = '2026-08-31T10:00:00.000-05:00';
const MINT_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const wallet: Wallet = {
  id: 'w-solana',
  owner,
  red: 'solana',
  direccion: '2VWvtXH5du9amnpU9NHP3dnry2ggSj6qcHwzwUn8DB5J',
  nombre: 'Solana',
};

const cuentaDe = (mint: string, amount: string) => ({
  account: { data: { parsed: { info: { mint, tokenAmount: { amount, decimals: 6 } } } } },
});

function doble(cuerpo: unknown) {
  // Tipado con los argumentos de `fetch`: sin ellos, `mock.calls` es una
  // tupla vacía y no se puede inspeccionar la petición, que es justo lo que
  // estas pruebas comprueban.
  return jest.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve({ json: () => Promise.resolve(cuerpo) } as unknown as Response),
  );
}

const conCuentas = (cuentas: unknown[]) => doble({ result: { value: cuentas } });

/** El cuerpo JSON de la primera petición. `body` es `BodyInit`, no `string`. */
function cuerpoDe(f: ReturnType<typeof doble>): string {
  const body = f.mock.calls[0]?.[1]?.body;
  if (typeof body !== 'string') throw new Error('la petición no llevó cuerpo de texto');
  return body;
}

const leer = (f: ReturnType<typeof doble>) =>
  createSolanaBalanceSource(f as unknown as typeof fetch, () => AHORA).leerSaldos(wallet);

describe('solanaBalanceSource', () => {
  /**
   * En Solana los tokens no están en la dirección del dueño: viven en cuentas
   * aparte colgadas de ella. Preguntar por el saldo de la dirección devolvería
   * los SOL, no los USDC.
   */
  it('pregunta por las cuentas de token del propietario', async () => {
    const f = conCuentas([]);

    await leer(f);

    const cuerpo = JSON.parse(cuerpoDe(f)) as {
      method: string;
      params: [string, { programId: string }, unknown];
    };
    expect(cuerpo.method).toBe('getTokenAccountsByOwner');
    expect(cuerpo.params[0]).toBe(wallet.direccion);
    expect(cuerpo.params[1].programId).toContain('Tokenkeg');
  });

  it('lee el saldo real de USDC', async () => {
    // 85.761 = 0,085761 USDC: el saldo real medido el 2026-08-31.
    const saldos = await leer(conCuentas([cuentaDe(MINT_USDC, '85761')]));

    expect(saldos.find((s) => s.token.simbolo === 'USDC')?.cantidad.amount).toBe(85_761n);
  });

  /**
   * Se lee `amount`, el entero exacto, nunca `uiAmount`, que viene con coma.
   */
  it('el saldo sale como entero, no como decimal', async () => {
    const saldos = await leer(conCuentas([cuentaDe(MINT_USDC, '85761')]));

    expect(typeof saldos[0]?.cantidad.amount).toBe('bigint');
  });

  it('suma varias cuentas del mismo token', async () => {
    // Una wallet puede tener más de una cuenta del mismo mint.
    const saldos = await leer(
      conCuentas([cuentaDe(MINT_USDC, '85761'), cuentaDe(MINT_USDC, '14239')]),
    );

    expect(saldos.find((s) => s.token.simbolo === 'USDC')?.cantidad.amount).toBe(100_000n);
  });

  it('devuelve los tokens seguidos aunque no tengan cuenta, en cero', async () => {
    const saldos = await leer(conCuentas([cuentaDe(MINT_USDC, '85761')]));

    expect(saldos).toHaveLength(2);
    expect(saldos.find((s) => s.token.simbolo === 'USDT')?.cantidad.amount).toBe(0n);
  });

  it('sin ninguna cuenta de token, devuelve ceros y no falla', async () => {
    const saldos = await leer(conCuentas([]));

    expect(saldos.every((s) => s.cantidad.amount === 0n)).toBe(true);
  });

  it('ignora los tokens que no se siguen', async () => {
    const saldos = await leer(
      conCuentas([cuentaDe(MINT_USDC, '85761'), cuentaDe('OtroMintCualquiera', '999')]),
    );

    expect(saldos).toHaveLength(2);
    expect(saldos.find((s) => s.token.simbolo === 'USDC')?.cantidad.amount).toBe(85_761n);
  });

  it('una respuesta que no es JSON lanza', async () => {
    const f = jest.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({
        json: () => Promise.reject(new SyntaxError('no')),
      } as unknown as Response),
    );

    await expect(leer(f)).rejects.toThrow(/no es JSON/);
  });

  it('un error del nodo sube con su mensaje', async () => {
    await expect(leer(doble({ error: { message: 'too many requests' } }))).rejects.toThrow(
      /too many requests/,
    );
  });

  it('anota cuándo se leyó', async () => {
    const saldos = await leer(conCuentas([cuentaDe(MINT_USDC, '85761')]));

    expect(saldos.every((s) => s.leidoEn === AHORA)).toBe(true);
  });
});

describe('mintsNoSeguidos', () => {
  /**
   * Un airdrop cualquiera no es patrimonio, pero enterarse de que llegó sí
   * importa: se decide en Ajustes, no se descarta en silencio.
   */
  it('lista lo que hay y no se sigue', () => {
    const otros = mintsNoSeguidos([cuentaDe(MINT_USDC, '1'), cuentaDe('MintRaro', '1')]);

    expect(otros).toEqual(['MintRaro']);
  });

  it('no repite un mint que aparece en varias cuentas', () => {
    expect(mintsNoSeguidos([cuentaDe('MintRaro', '1'), cuentaDe('MintRaro', '2')])).toEqual([
      'MintRaro',
    ]);
  });

  it('sin nada raro, la lista está vacía', () => {
    expect(mintsNoSeguidos([cuentaDe(MINT_USDC, '1')])).toEqual([]);
  });
});
