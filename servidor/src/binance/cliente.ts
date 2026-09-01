import { consultaFirmada } from './firma';
import type { RestriccionesApi } from './permisos';

const BASE = 'https://api.binance.com';
const TIEMPO_LIMITE = 15_000;

export interface ConfigBinance {
  clave: string;
  secreto: string;
}

export interface SaldoBinance {
  /** El símbolo tal como lo llama Binance: «USDC», «USDT». */
  activo: string;
  /** Entero en la unidad mínima de la moneda. */
  cantidad: bigint;
}

interface CuentaBinance {
  balances?: { asset?: string; free?: string; locked?: string }[];
}

interface ErrorBinance {
  code?: number;
  msg?: string;
}

/** Los activos que se siguen. Lo demás no se guarda ni se enseña. */
const SEGUIDOS: Record<string, number> = { USDC: 6, USDT: 6 };

/**
 * Convierte «0.08576100» en un entero con la escala de la moneda.
 *
 * `parseFloat` aquí introduce un error que después se multiplica por el saldo.
 */
export function aEntero(texto: string, escala: number): bigint {
  const limpio = texto.trim();
  if (!/^\d+(\.\d+)?$/.test(limpio)) throw new Error('Binance devolvió un saldo que no es número');
  const [entera = '0', decimal = ''] = limpio.split('.');
  return BigInt(`${entera}${decimal.padEnd(escala, '0').slice(0, escala)}`);
}

export type Fetch = typeof fetch;

/**
 * El cliente de Binance, de solo lectura.
 *
 * Vive en el servidor y no en el teléfono, igual que la contraseña del correo
 * desde el sprint 06: el teléfono no guarda credenciales que toquen dinero.
 *
 * **Ningún error de aquí puede llevar la clave, el secreto ni la firma.** Los
 * mensajes acaban en registros que no controlamos.
 */
export function crearClienteBinance(config: ConfigBinance, hacerFetch: Fetch = fetch) {
  const pedir = async <T>(ruta: string, parametros: Record<string, string> = {}): Promise<T> => {
    const consulta = consultaFirmada(parametros, config.secreto);
    const respuesta = await hacerFetch(`${BASE}${ruta}?${consulta}`, {
      headers: { 'X-MBX-APIKEY': config.clave },
      signal: AbortSignal.timeout(TIEMPO_LIMITE),
    });

    const cuerpo = (await respuesta.json().catch(() => {
      throw new Error('Binance respondió algo que no es JSON');
    })) as T & ErrorBinance;

    // **El estado HTTP manda, pase lo que pase en el cuerpo.**
    //
    // Aquí hubo dos errores encadenados. El primero: no mirar el estado, así
    // que un rechazo se devolvía como si fuera una respuesta buena y quien la
    // recibía veía un objeto vacío —el servidor se negó a arrancar diciendo
    // «la clave no puede leer», que era falso—. El segundo: arreglarlo solo
    // para los cuerpos sin `code`, que deja fuera el caso que importaba.
    //
    // Binance responde **451 con `code: 0`** cuando la petición sale de un país
    // restringido, y cero **no es menor que cero**: pasaba las dos rejas. Es
    // exactamente lo que ocurre desde Railway, cuyos servidores están en
    // Estados Unidos.
    if (!respuesta.ok) {
      // Se conserva todo lo que Binance dice: el código distingue causas que
      // el estado no —-2014 es «formato de clave inválido» y -2015 es «clave,
      // IP o permisos»— y el mensaje es lo que se puede leer sin buscar tablas.
      const codigo = typeof cuerpo.code === 'number' ? ` (${String(cuerpo.code)})` : '';
      const detalle =
        typeof cuerpo.msg === 'string' && cuerpo.msg.length > 0 ? `: ${cuerpo.msg}` : '';
      throw new Error(`Binance respondió ${String(respuesta.status)}${codigo}${detalle}`);
    }

    // Un código negativo con estado 200: Binance lo hace en algunas rutas.
    if (typeof cuerpo.code === 'number' && cuerpo.code < 0) {
      // El código y el mensaje de Binance, nunca la petición: la cadena
      // firmada lleva la firma dentro.
      throw new Error(`Binance rechazó la petición (${String(cuerpo.code)}): ${cuerpo.msg ?? ''}`);
    }
    return cuerpo;
  };

  return {
    /** Qué puede hacer la clave. Se comprueba al arrancar. */
    permisos: () => pedir<RestriccionesApi>('/sapi/v1/account/apiRestrictions'),

    /**
     * Los saldos que no son cero, de los activos seguidos.
     *
     * Binance devuelve cientos de monedas, casi todas en cero. Y suma `free` y
     * `locked`: lo bloqueado en una orden sigue siendo suyo.
     */
    saldos: async (): Promise<SaldoBinance[]> => {
      const cuenta = await pedir<CuentaBinance>('/api/v3/account');
      const saldos: SaldoBinance[] = [];
      for (const fila of cuenta.balances ?? []) {
        const escala = fila.asset === undefined ? undefined : SEGUIDOS[fila.asset];
        if (fila.asset === undefined || escala === undefined) continue;
        const cantidad = aEntero(fila.free ?? '0', escala) + aEntero(fila.locked ?? '0', escala);
        if (cantidad > 0n) saldos.push({ activo: fila.asset, cantidad });
      }
      return saldos;
    },
  };
}
