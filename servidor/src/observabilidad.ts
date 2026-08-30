/**
 * Registro del servidor, con la misma disciplina que en la app: lo que se
 * emite pasa por una redacción, porque aquí circulan correos bancarios
 * enteros y una traza con un cuerpo de correo es una filtración.
 */
export interface Observabilidad {
  log: (nivel: 'info' | 'warn' | 'error', mensaje: string, datos?: Record<string, unknown>) => void;
  captureError: (error: unknown, contexto?: Record<string, unknown>) => void;
}

const SENSIBLES =
  /(token|password|clave|secret|authorization|cookie|monto|saldo|texto|html|cuerpo)/i;

export function redactar(datos: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(datos).map(([clave, valor]) => [
      clave,
      SENSIBLES.test(clave) ? '[redactado]' : valor,
    ]),
  );
}

export function crearObservabilidad(): Observabilidad {
  const escribir = (nivel: string, mensaje: string, datos: Record<string, unknown>): void => {
    // Única salida del proceso: la recoge el proveedor de despliegue. No es
    // `console` —que está prohibido— sino la salida deliberada, en un solo sitio.
    process.stdout.write(
      `${JSON.stringify({ ts: new Date().toISOString(), nivel, mensaje, ...redactar(datos) })}\n`,
    );
  };

  return {
    log: (nivel, mensaje, datos = {}) => {
      escribir(nivel, mensaje, datos);
    },
    captureError: (error, contexto = {}) => {
      escribir('error', error instanceof Error ? error.message : String(error), {
        ...contexto,
        pila: error instanceof Error ? error.stack : undefined,
      });
    },
  };
}
