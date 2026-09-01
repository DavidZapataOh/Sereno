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

/**
 * La billetera de Fondos, comprobada contra la API real el 2026-08-31.
 *
 * Devuelve un arreglo, no un objeto con `balances` como Spot, y trae dos
 * columnas más: `freeze` y `withdrawing`.
 */
interface ActivoDeFondos {
  asset?: string;
  free?: string;
  locked?: string;
  freeze?: string;
  withdrawing?: string;
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
  const pedir = async <T>(
    ruta: string,
    parametros: Record<string, string> = {},
    metodo: 'GET' | 'POST' = 'GET',
  ): Promise<T> => {
    const consulta = consultaFirmada(parametros, config.secreto);
    // La firma va en la URL también en POST: Binance no la lee del cuerpo, y
    // mandarla ahí devuelve un error de firma que no menciona el método.
    const respuesta = await hacerFetch(`${BASE}${ruta}?${consulta}`, {
      method: metodo,
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
     * Los saldos que no son cero, de los activos seguidos, **sumando Spot y
     * Fondos**.
     *
     * Son dos billeteras distintas con dos endpoints distintos, y el dinero
     * puede estar en cualquiera de las dos —el de David estaba en Fondos, y
     * mirar solo Spot devolvía cero, que no se distingue de no tener nada—.
     *
     * **Se suman en un solo número por activo, no en dos cuentas.** Mover
     * dinero de Fondos a Spot es cambiarlo de bolsillo, no ganarlo ni
     * perderlo: con cuentas separadas, cada traslado dejaría dos ajustes que se
     * anulan, y eso es ruido en el historial.
     *
     * Binance devuelve cientos de monedas, casi todas en cero.
     */
    saldos: async (): Promise<SaldoBinance[]> => {
      const [spot, fondos] = await Promise.all([
        pedir<CuentaBinance>('/api/v3/account'),
        pedir<ActivoDeFondos[]>('/sapi/v1/asset/get-funding-asset', {}, 'POST'),
      ]);

      const porActivo = new Map<string, bigint>();
      const sumar = (activo: string | undefined, partes: (string | undefined)[]): void => {
        const escala = activo === undefined ? undefined : SEGUIDOS[activo];
        if (activo === undefined || escala === undefined) return;
        const total = partes.reduce((acc, p) => acc + aEntero(p ?? '0', escala), 0n);
        porActivo.set(activo, (porActivo.get(activo) ?? 0n) + total);
      };

      // Spot: lo bloqueado en una orden sigue siendo suyo.
      for (const fila of spot.balances ?? []) sumar(fila.asset, [fila.free, fila.locked]);

      // Fondos: además de `locked`, hay `freeze` y `withdrawing`. Lo que está
      // saliendo en un retiro todavía es suyo hasta que llega al otro lado;
      // descontarlo lo haría desaparecer a mitad de camino.
      for (const fila of Array.isArray(fondos) ? fondos : []) {
        sumar(fila.asset, [fila.free, fila.locked, fila.freeze, fila.withdrawing]);
      }

      return [...porActivo]
        .filter(([, cantidad]) => cantidad > 0n)
        .map(([activo, cantidad]) => ({ activo, cantidad }));
    },
  };
}
