import { aMoneda, type BalanceSource, type SaldoLeido } from '@/domain/crypto/balance-source';
import { tokensDe, type Wallet } from '@/domain/crypto/wallet';
import { money } from '@/domain/money/money';

import type { Fetch } from './evm-balance-source';

export const NODO_SOLANA = 'https://api.mainnet-beta.solana.com';

/** El programa que gobierna los tokens de Solana. */
const PROGRAMA_TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

const TIEMPO_LIMITE = 15_000;

interface CuentaDeToken {
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          /** `amount` es el entero exacto; `uiAmount` viene con coma. */
          tokenAmount: { amount: string; decimals: number };
        };
      };
    };
  };
}

interface RespuestaSolana {
  result?: { value?: CuentaDeToken[] };
  error?: { message?: string };
}

/**
 * Los saldos de una wallet de Solana.
 *
 * **No es el adaptador de EVM con otra URL.** En Solana los tokens no viven en
 * la dirección del dueño: viven en cuentas aparte colgadas de ella, y se piden
 * con `getTokenAccountsByOwner`. Preguntar por el saldo de la dirección
 * devolvería los SOL, no los USDC.
 */
export function createSolanaBalanceSource(
  hacerFetch: Fetch = fetch,
  reloj: () => string = () => new Date().toISOString(),
): BalanceSource {
  return {
    chain: 'solana',
    leerSaldos: async (wallet: Wallet): Promise<SaldoLeido[]> => {
      const respuesta = await hacerFetch(NODO_SOLANA, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [wallet.direccion, { programId: PROGRAMA_TOKEN }, { encoding: 'jsonParsed' }],
        }),
        signal: AbortSignal.timeout(TIEMPO_LIMITE),
      });

      const cuerpo = (await respuesta.json().catch(() => {
        throw new Error('El nodo de Solana respondió algo que no es JSON');
      })) as RespuestaSolana;

      if (cuerpo.error !== undefined) {
        throw new Error(`El nodo de Solana falló: ${cuerpo.error.message ?? 'sin detalle'}`);
      }
      if (cuerpo.result?.value === undefined) {
        throw new Error('El nodo de Solana no devolvió resultado');
      }

      const leidoEn = reloj();
      const porMint = new Map<string, bigint>();
      for (const cuenta of cuerpo.result.value) {
        const info = cuenta.account.data.parsed.info;
        // Se lee `amount`, el entero exacto, nunca `uiAmount`, que viene con
        // coma y pierde precisión. Con seis decimales aún no duele; con
        // dieciocho, sí.
        const anterior = porMint.get(info.mint) ?? 0n;
        porMint.set(info.mint, anterior + BigInt(info.tokenAmount.amount));
      }

      // Todos los tokens seguidos, incluidos los que no aparecen: un cero es
      // «miré y no hay», y hay que poder distinguirlo de «no miré».
      return tokensDe('solana').map((token) => {
        const crudo = porMint.get(token.contrato);
        return {
          token,
          cantidad: crudo === undefined ? money(0n, token.currency) : aMoneda(crudo, token),
          leidoEn,
        };
      });
    },
  };
}

/**
 * Los mints que la wallet tiene y Sereno no sigue.
 *
 * No se descartan en silencio: un airdrop cualquiera no es patrimonio, pero
 * enterarse de que llegó sí importa, y se decide en Ajustes.
 */
export function mintsNoSeguidos(cuentas: readonly CuentaDeToken[]): string[] {
  const seguidos = new Set(tokensDe('solana').map((t) => t.contrato));
  return [
    ...new Set(
      cuentas.map((c) => c.account.data.parsed.info.mint).filter((mint) => !seguidos.has(mint)),
    ),
  ];
}
