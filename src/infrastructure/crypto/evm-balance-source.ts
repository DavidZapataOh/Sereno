import { aMoneda, type BalanceSource, type SaldoLeido } from '@/domain/crypto/balance-source';
import { tokensDe, type ChainEvm, type Wallet } from '@/domain/crypto/wallet';

/**
 * El nodo público de cada cadena.
 *
 * Se eligieron los de `publicnode` donde había alternativa: los primeros que
 * se probaron —`llamarpc`— devolvían HTML cuando limitaban, y una respuesta
 * que no es JSON tomada como saldo cero borraría plata de la pantalla.
 */
export const NODOS: Record<ChainEvm, string> = {
  ethereum: 'https://ethereum-rpc.publicnode.com',
  polygon: 'https://polygon-bor-rpc.publicnode.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  base: 'https://mainnet.base.org',
  bsc: 'https://bsc-rpc.publicnode.com',
  optimism: 'https://mainnet.optimism.io',
  avalanche: 'https://avalanche-c-chain-rpc.publicnode.com',
  linea: 'https://rpc.linea.build',
  scroll: 'https://rpc.scroll.io',
  gnosis: 'https://rpc.gnosischain.com',
  celo: 'https://forno.celo.org',
  zksync: 'https://mainnet.era.zksync.io',
  mantle: 'https://rpc.mantle.xyz',
  sonic: 'https://rpc.soniclabs.com',
};

/**
 * `balanceOf(address)`: el selector de la función seguido de la dirección
 * rellenada a 32 bytes.
 *
 * Si el relleno se hace mal, el nodo **responde cero sin quejarse**. Es el
 * error más silencioso de todo el adaptador, y por eso hay una prueba que
 * compara la petición carácter a carácter.
 */
export function datosDeBalanceOf(direccion: string): string {
  return `0x70a08231${direccion.slice(2).toLowerCase().padStart(64, '0')}`;
}

export type Fetch = typeof fetch;

interface RespuestaRpc {
  result?: string;
  error?: { message?: string };
}

/** Milisegundos antes de darse por vencido con un nodo. */
const TIEMPO_LIMITE = 15_000;

export function createEvmBalanceSource(
  chain: ChainEvm,
  hacerFetch: Fetch = fetch,
  reloj: () => string = () => new Date().toISOString(),
): BalanceSource {
  return {
    chain,
    leerSaldos: async (wallet: Wallet): Promise<SaldoLeido[]> => {
      const saldos: SaldoLeido[] = [];
      for (const token of tokensDe(chain)) {
        const respuesta = await hacerFetch(NODOS[chain], {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: token.contrato, data: datosDeBalanceOf(wallet.direccion) }, 'latest'],
          }),
          signal: AbortSignal.timeout(TIEMPO_LIMITE),
        });

        // Un nodo caído o limitando devuelve HTML. Si eso se tomara como cero,
        // el saldo desaparecería de la pantalla sin que nadie se enterara.
        const cuerpo = (await respuesta.json().catch(() => {
          throw new Error(`El nodo de ${chain} respondió algo que no es JSON`);
        })) as RespuestaRpc;

        if (cuerpo.error !== undefined) {
          throw new Error(`El nodo de ${chain} falló: ${cuerpo.error.message ?? 'sin detalle'}`);
        }
        if (cuerpo.result === undefined) {
          throw new Error(`El nodo de ${chain} no devolvió resultado`);
        }

        // Un contrato sin saldo puede responder «0x» a secas. No es un fallo.
        const crudo = cuerpo.result === '0x' ? 0n : BigInt(cuerpo.result);
        saldos.push({ token, cantidad: aMoneda(crudo, token), leidoEn: reloj() });
      }
      return saldos;
    },
  };
}
