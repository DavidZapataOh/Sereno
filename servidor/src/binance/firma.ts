import { createHmac } from 'node:crypto';

/**
 * Cuánto puede tardar la petición en llegar a Binance antes de que la
 * descarte.
 *
 * Sin este parámetro Binance usa 5000 ms, y una petición lenta falla con un
 * error de firma que parece un problema de credenciales. Declararlo hace que
 * el fallo diga lo que es.
 */
export const VENTANA_MS = 10_000;

/**
 * Firma la cadena de consulta.
 *
 * Binance firma los parámetros **en el orden en que se envían**, así que el
 * orden es parte del contrato: reordenarlos invalida la firma, y el error que
 * devuelve —«Signature for this request is not valid»— no dice nada de la
 * causa.
 */
export function firmar(consulta: string, secreto: string): string {
  return createHmac('sha256', secreto).update(consulta).digest('hex');
}

/** Los parámetros con `timestamp`, `recvWindow` y la firma al final. */
export function consultaFirmada(
  parametros: Record<string, string>,
  secreto: string,
  ahora: () => number = Date.now,
): string {
  const conTiempo = {
    ...parametros,
    timestamp: String(ahora()),
    recvWindow: String(VENTANA_MS),
  };
  const consulta = new URLSearchParams(conTiempo).toString();
  // La firma va al final: Binance lo exige.
  return `${consulta}&signature=${firmar(consulta, secreto)}`;
}
