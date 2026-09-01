import type { Hono } from 'hono';

import type { SaldoBinance } from '../binance/cliente';
import type { Observabilidad } from '../observabilidad';

/** De dónde salen los saldos. Ausente si no hay claves configuradas. */
export type SaldosBinance = () => Promise<SaldoBinance[]>;

/**
 * Por qué no hay saldos, cuando no los hay.
 *
 * «No hay claves» y «la clave fue rechazada» piden cosas distintas —añadir dos
 * variables, o revisar la que ya está— y desde fuera se veían igual: hubo que
 * mirar los registros de Railway para distinguirlas. Un estado que no se puede
 * distinguir es un estado que no sirve.
 */
export type MotivoSinBinance = 'sin-claves' | 'clave-rechazada';

/**
 * Los saldos del exchange, para que el teléfono los meta a su ledger.
 *
 * Vive en el servidor y no en el teléfono porque ahí están las claves, igual
 * que la contraseña del correo desde el sprint 06.
 *
 * **Las cantidades viajan como texto.** Un entero de escala cripto no cabe en
 * un `number` de JSON sin perder dígitos, y perder dígitos aquí es perder
 * plata. Es lo mismo que hace `movimientos` con los montos en la base.
 *
 * Y **un fallo nunca se responde como lista vacía**: el teléfono la tomaría
 * por «no tienes nada» y borraría el saldo de la pantalla. Cero y «no pude
 * mirar» son cosas distintas, y confundirlas es de lo peor que puede hacer
 * una app de dinero.
 */
export function montarSaldos(
  app: Hono,
  observabilidad: Observabilidad,
  saldosBinance?: SaldosBinance,
  motivo: MotivoSinBinance = 'sin-claves',
): void {
  app.get('/saldos', async (c) => {
    if (saldosBinance === undefined) {
      // 503 y no 200 con lista vacía: no está configurado, que no es lo mismo
      // que no tener nada. Y se dice **cuál** de los dos casos es.
      return c.json(
        {
          error:
            motivo === 'sin-claves'
              ? 'Binance no está configurado'
              : 'Binance está configurado pero la clave fue rechazada: revísala',
          motivo,
        },
        503,
      );
    }

    try {
      const saldos = await saldosBinance();
      return c.json({
        saldos: saldos.map((s) => ({ activo: s.activo, cantidad: s.cantidad.toString() })),
      });
    } catch (error) {
      observabilidad.captureError(error, { ruta: '/saldos' });
      // El detalle va al registro, no a la respuesta: los errores de Binance
      // no llevan la clave, pero la regla es no arriesgarse.
      return c.json({ error: 'No se pudieron leer los saldos de Binance' }, 502);
    }
  });
}
